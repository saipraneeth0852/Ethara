const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("../middleware/auth");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((error) => ({ field: error.param, message: error.msg })) });
  }
  next();
}

module.exports = (pool) => {
  const router = express.Router();

  async function getProjectById(id) {
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async function getUserById(id) {
    const result = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async function getProjectMember(projectId, userId) {
    const result = await pool.query("SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, userId]);
    return result.rows[0] || null;
  }

  async function getTaskById(id) {
    const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async function logActivity(projectId, userId, action, entityId) {
    await pool.query(
      `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), projectId, userId, action, "task", entityId, new Date().toISOString()]
    );
  }

  async function requireProjectAccess(req, res, next) {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (req.user.role === "admin") {
        req.project = project;
        req.projectMembership = null;
        return next();
      }

      const membership = await getProjectMember(project.id, req.user.id);
      if (!membership && project.owner_id !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.project = project;
      req.projectMembership = membership;
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async function requireProjectAdmin(req, res, next) {
    requireProjectAccess(req, res, () => {
      const isAdminRole = req.user.role === "admin";
      const isOwner = req.project.owner_id === req.user.id;
      const isProjectAdmin = req.projectMembership?.role === "admin";
      if (!isAdminRole && !isOwner && !isProjectAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    });
  }

  async function requireTaskAccess(req, res, next) {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const project = await getProjectById(task.project_id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const membership = await getProjectMember(project.id, req.user.id);
      const isAssignee = req.user.id === task.assignee_id;
      const isAdminRole = req.user.role === "admin";
      const isProjectAdmin = membership?.role === "admin" || project.owner_id === req.user.id;
      if (!isAdminRole && !isAssignee && !isProjectAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.task = task;
      req.project = project;
      req.projectMembership = membership;
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  router.get(
    "/projects/:id/tasks",
    requireAuth,
    [param("id").isUUID().withMessage("Invalid project ID"), query("status").optional().isIn(["todo", "in_progress", "done"]), query("assignee_id").optional().isUUID().withMessage("Invalid assignee ID")],
    handleValidation,
    requireProjectAccess,
    async (req, res) => {
      try {
        const values = [req.project.id];
        let statement = `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.assignee_id,
                                u.name AS assignee_name, u.email AS assignee_email
                         FROM tasks t
                         LEFT JOIN users u ON u.id = t.assignee_id
                         WHERE t.project_id = $1`;

        if (req.query.status) {
          values.push(req.query.status);
          statement += ` AND t.status = $${values.length}`;
        }
        if (req.query.assignee_id) {
          values.push(req.query.assignee_id);
          statement += ` AND t.assignee_id = $${values.length}`;
        }

        statement += " ORDER BY t.created_at DESC";

        const result = await pool.query(statement, values);
        const tasks = result.rows.map((task) => ({
          ...task,
          assignee: task.assignee_id ? { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email } : null,
        }));

        return res.json(tasks);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.post(
    "/projects/:id/tasks",
    requireAuth,
    requireProjectAdmin,
    [
      param("id").isUUID().withMessage("Invalid project ID"),
      body("title").trim().notEmpty().withMessage("Task title is required").isLength({ max: 100 }).withMessage("Task title must be 100 characters or fewer"),
      body("description").optional().isString(),
      body("priority").isIn(["low", "medium", "high"]).withMessage("Invalid priority"),
      body("due_date").optional().isISO8601().toDate().withMessage("Invalid due date"),
      body("assignee_id").optional().isUUID().withMessage("Invalid assignee ID"),
    ],
    handleValidation,
    async (req, res) => {
      const { title, description, priority, due_date, assignee_id } = req.body;

      try {
        if (assignee_id) {
          const assignee = await getUserById(assignee_id);
          if (!assignee) {
            return res.status(404).json({ message: "Assignee not found" });
          }
          const membership = await getProjectMember(req.project.id, assignee_id);
          if (!membership) {
            return res.status(400).json({ message: "Assignee must be a member of the project" });
          }
        }

        const taskId = uuidv4();
        await pool.query(
          `INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, assignee_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            taskId,
            title.trim(),
            description || null,
            "todo",
            priority,
            due_date ? new Date(due_date).toISOString().split("T")[0] : null,
            req.project.id,
            assignee_id || null,
            req.user.id,
            new Date().toISOString(),
          ]
        );

        await logActivity(req.project.id, req.user.id, `created task ${title.trim()}`, taskId);
        return res.status(201).json({ message: "Task created", id: taskId });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.patch(
    "/:id",
    requireAuth,
    async (req, res, next) => {
      try {
        const task = await getTaskById(req.params.id);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const project = await getProjectById(task.project_id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const membership = await getProjectMember(project.id, req.user.id);
        const isAdminRole = req.user.role === "admin";
        const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
        if (!isAdminRole && !isProjectAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }

        req.task = task;
        req.project = project;
        req.projectMembership = membership;
        return next();
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
    [
      param("id").isUUID().withMessage("Invalid task ID"),
      body("title").optional().trim().notEmpty().withMessage("Task title is required").isLength({ max: 100 }).withMessage("Task title must be 100 characters or fewer"),
      body("description").optional().isString(),
      body("priority").optional().isIn(["low", "medium", "high"]).withMessage("Invalid priority"),
      body("due_date").optional().isISO8601().toDate().withMessage("Invalid due date"),
    ],
    handleValidation,
    async (req, res) => {
      const updates = [];
      const values = [];
      const { title, description, priority, due_date } = req.body;

      if (title !== undefined) {
        values.push(title.trim());
        updates.push(`title = $${values.length}`);
      }
      if (description !== undefined) {
        values.push(description || null);
        updates.push(`description = $${values.length}`);
      }
      if (priority !== undefined) {
        values.push(priority);
        updates.push(`priority = $${values.length}`);
      }
      if (due_date !== undefined) {
        values.push(due_date ? new Date(due_date).toISOString().split("T")[0] : null);
        updates.push(`due_date = $${values.length}`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      try {
        values.push(new Date().toISOString());
        updates.push(`updated_at = $${values.length}`);
        values.push(req.params.id);
        await pool.query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
        await logActivity(req.task.project_id, req.user.id, `updated task ${req.task.id}`, req.task.id);
        return res.json({ message: "Task updated" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.patch(
    "/:id/status",
    requireAuth,
    [
      param("id").isUUID().withMessage("Invalid task ID"),
      body("status").isIn(["todo", "in_progress", "done"]).withMessage("Invalid status"),
    ],
    handleValidation,
    requireTaskAccess,
    async (req, res) => {
      const { status } = req.body;
      try {
        await pool.query("UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3", [status, new Date().toISOString(), req.task.id]);
        await logActivity(req.project.id, req.user.id, `changed status to ${status}`, req.task.id);
        return res.json({ message: "Task status updated" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.patch(
    "/:id/assign",
    requireAuth,
    async (req, res, next) => {
      try {
        const task = await getTaskById(req.params.id);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const project = await getProjectById(task.project_id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const membership = await getProjectMember(project.id, req.user.id);
        const isAdminRole = req.user.role === "admin";
        const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
        if (!isAdminRole && !isProjectAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }

        req.task = task;
        req.project = project;
        req.projectMembership = membership;
        return next();
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
    [param("id").isUUID().withMessage("Invalid task ID"), body("assignee_id").optional().isUUID().withMessage("Invalid assignee ID")],
    handleValidation,
    async (req, res) => {
      const { assignee_id } = req.body;
      try {
        if (assignee_id) {
          const assignee = await getUserById(assignee_id);
          if (!assignee) {
            return res.status(404).json({ message: "Assignee not found" });
          }
          const membership = await getProjectMember(req.task.project_id, assignee_id);
          if (!membership) {
            return res.status(400).json({ message: "Assignee must be a project member" });
          }
        }

        await pool.query("UPDATE tasks SET assignee_id = $1, updated_at = $2 WHERE id = $3", [assignee_id || null, new Date().toISOString(), req.task.id]);
        await logActivity(req.task.project_id, req.user.id, `assigned task to ${assignee_id || "unassigned"}`, req.task.id);
        return res.json({ message: "Task assignment updated" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.delete(
    "/:id",
    requireAuth,
    async (req, res, next) => {
      try {
        const task = await getTaskById(req.params.id);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const project = await getProjectById(task.project_id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const membership = await getProjectMember(project.id, req.user.id);
        const isAdminRole = req.user.role === "admin";
        const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
        if (!isAdminRole && !isProjectAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }

        req.task = task;
        req.project = project;
        req.projectMembership = membership;
        return next();
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
    [param("id").isUUID().withMessage("Invalid task ID")],
    handleValidation,
    async (req, res) => {
      try {
        await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
        await logActivity(req.task.project_id, req.user.id, `deleted task ${req.task.id}`, req.task.id);
        return res.json({ message: "Task deleted" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  return router;
};
