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

module.exports = (db) => {
  const router = express.Router();
  const getProjectById = db.prepare("SELECT * FROM projects WHERE id = ?");
  const getUserById = db.prepare("SELECT id, name, email FROM users WHERE id = ?");
  const getProjectMember = db.prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?");
  const getTaskById = db.prepare("SELECT * FROM tasks WHERE id = ?");
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, assignee_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const logActivity = db.prepare(
    `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  function requireProjectAccess(req, res, next) {
    const project = getProjectById.get(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (req.user.role === "admin") {
      req.project = project;
      req.projectMembership = null;
      return next();
    }

    const membership = getProjectMember.get(project.id, req.user.id);
    if (!membership && project.owner_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.project = project;
    req.projectMembership = membership;
    return next();
  }

  function requireProjectAdmin(req, res, next) {
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

  function requireTaskAccess(req, res, next) {
    const task = getTaskById.get(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = getProjectById.get(task.project_id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const membership = getProjectMember.get(project.id, req.user.id);
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
  }

  router.get(
    "/projects/:id/tasks",
    requireAuth,
    [param("id").isUUID().withMessage("Invalid project ID"), query("status").optional().isIn(["todo", "in_progress", "done"]), query("assignee_id").optional().isUUID().withMessage("Invalid assignee ID")],
    handleValidation,
    requireProjectAccess,
    (req, res) => {
      const filters = [req.project.id];
      let query = `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.assignee_id, u.name AS assignee_name, u.email AS assignee_email
                   FROM tasks t
                   LEFT JOIN users u ON u.id = t.assignee_id
                   WHERE t.project_id = ?`;

      if (req.query.status) {
        query += " AND t.status = ?";
        filters.push(req.query.status);
      }
      if (req.query.assignee_id) {
        query += " AND t.assignee_id = ?";
        filters.push(req.query.assignee_id);
      }
      query += " ORDER BY t.created_at DESC";

      const tasks = db.prepare(query).all(...filters).map((task) => ({
        ...task,
        assignee: task.assignee_id ? { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email } : null,
      }));
      return res.json(tasks);
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
    (req, res) => {
      const { title, description, priority, due_date, assignee_id } = req.body;
      if (assignee_id) {
        const assignee = getUserById.get(assignee_id);
        if (!assignee) {
          return res.status(404).json({ message: "Assignee not found" });
        }
        const membership = getProjectMember.get(req.project.id, assignee_id);
        if (!membership) {
          return res.status(400).json({ message: "Assignee must be a member of the project" });
        }
      }

      const taskId = uuidv4();
      insertTask.run(
        taskId,
        title.trim(),
        description || null,
        "todo",
        priority,
        due_date ? new Date(due_date).toISOString().split("T")[0] : null,
        req.project.id,
        assignee_id || null,
        req.user.id,
        new Date().toISOString()
      );

      logActivity.run(uuidv4(), req.project.id, req.user.id, `created task ${title.trim()}`, "task", taskId, new Date().toISOString());
      return res.status(201).json({ message: "Task created", id: taskId });
    }
  );

  router.patch(
    "/:id",
    requireAuth,
    (req, res, next) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const project = getProjectById.get(task.project_id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const membership = getProjectMember.get(project.id, req.user.id);
      const isAdminRole = req.user.role === "admin";
      const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
      if (!isAdminRole && !isProjectAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.task = task;
      req.project = project;
      req.projectMembership = membership;
      return next();
    },
    [
      param("id").isUUID().withMessage("Invalid task ID"),
      body("title").optional().trim().notEmpty().withMessage("Task title is required").isLength({ max: 100 }).withMessage("Task title must be 100 characters or fewer"),
      body("description").optional().isString(),
      body("priority").optional().isIn(["low", "medium", "high"]).withMessage("Invalid priority"),
      body("due_date").optional().isISO8601().toDate().withMessage("Invalid due date"),
    ],
    handleValidation,
    (req, res) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updates = [];
      const values = [];
      const { title, description, priority, due_date } = req.body;

      if (title !== undefined) {
        updates.push("title = ?");
        values.push(title.trim());
      }
      if (description !== undefined) {
        updates.push("description = ?");
        values.push(description || null);
      }
      if (priority !== undefined) {
        updates.push("priority = ?");
        values.push(priority);
      }
      if (due_date !== undefined) {
        updates.push("due_date = ?");
        values.push(due_date ? new Date(due_date).toISOString().split("T")[0] : null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      values.push(new Date().toISOString());
      values.push(req.params.id);
      db.prepare(`UPDATE tasks SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`).run(...values);
      logActivity.run(uuidv4(), task.project_id, req.user.id, `updated task ${task.id}`, "task", task.id, new Date().toISOString());
      return res.json({ message: "Task updated" });
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
    (req, res) => {
      const { status } = req.body;
      db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), req.task.id);
      logActivity.run(uuidv4(), req.project.id, req.user.id, `changed status to ${status}`, "task", req.task.id, new Date().toISOString());
      return res.json({ message: "Task status updated" });
    }
  );

  router.patch(
    "/:id/assign",
    requireAuth,
    (req, res, next) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const project = getProjectById.get(task.project_id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const membership = getProjectMember.get(project.id, req.user.id);
      const isAdminRole = req.user.role === "admin";
      const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
      if (!isAdminRole && !isProjectAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.task = task;
      req.project = project;
      req.projectMembership = membership;
      return next();
    },
    [param("id").isUUID().withMessage("Invalid task ID"), body("assignee_id").optional().isUUID().withMessage("Invalid assignee ID")],
    handleValidation,
    (req, res) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const { assignee_id } = req.body;
      if (assignee_id) {
        const assignee = getUserById.get(assignee_id);
        if (!assignee) {
          return res.status(404).json({ message: "Assignee not found" });
        }
        const membership = getProjectMember.get(task.project_id, assignee_id);
        if (!membership) {
          return res.status(400).json({ message: "Assignee must be a project member" });
        }
      }

      db.prepare("UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?").run(assignee_id || null, new Date().toISOString(), task.id);
      logActivity.run(uuidv4(), task.project_id, req.user.id, `assigned task to ${assignee_id || "unassigned"}`, "task", task.id, new Date().toISOString());
      return res.json({ message: "Task assignment updated" });
    }
  );

  router.delete(
    "/:id",
    requireAuth,
    (req, res, next) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const project = getProjectById.get(task.project_id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const membership = getProjectMember.get(project.id, req.user.id);
      const isAdminRole = req.user.role === "admin";
      const isProjectAdmin = project.owner_id === req.user.id || membership?.role === "admin";
      if (!isAdminRole && !isProjectAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.task = task;
      req.project = project;
      req.projectMembership = membership;
      return next();
    },
    [param("id").isUUID().withMessage("Invalid task ID")],
    handleValidation,
    (req, res) => {
      const task = getTaskById.get(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
      logActivity.run(uuidv4(), task.project_id, req.user.id, `deleted task ${task.id}`, "task", task.id, new Date().toISOString());
      return res.json({ message: "Task deleted" });
    }
  );

  return router;
};
