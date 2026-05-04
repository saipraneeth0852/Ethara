const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("../middleware/auth");
const { checkRole } = require("../middleware/rbac");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((error) => ({ field: error.param, message: error.msg })) });
  }
  next();
}

function sanitizeProject(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    owner_id: project.owner_id,
    created_at: project.created_at,
    member_count: Number(project.member_count) || 0,
    task_count: Number(project.task_count) || 0,
    done_count: Number(project.done_count) || 0,
  };
}

module.exports = (pool) => {
  const router = express.Router();

  async function getProjectById(id) {
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async function getMemberStatus(projectId, userId) {
    const result = await pool.query("SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, userId]);
    return result.rows[0] || null;
  }

  async function getUserByEmail(email) {
    const result = await pool.query("SELECT id, name, email, role FROM users WHERE lower(email) = lower($1)", [email]);
    return result.rows[0] || null;
  }

  async function getUserById(id) {
    const result = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async function getProjectMembers(projectId) {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, pm.role AS project_role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [projectId]
    );
    return result.rows;
  }

  async function getProjectTasks(projectId) {
    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.assignee_id,
              u.name AS assignee_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [projectId]
    );
    return result.rows;
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

      const membership = await getMemberStatus(project.id, req.user.id);
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
      const isAdmin =
        req.user.role === "admin" ||
        req.project.owner_id === req.user.id ||
        req.projectMembership?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return next();
    });
  }

  router.get("/", requireAuth, async (req, res) => {
    try {
      const query = req.user.role === "admin"
        ? `SELECT p.*,
              (SELECT COUNT(1) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
              (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
           FROM projects p
           ORDER BY p.created_at DESC`
        : `SELECT p.*,
              (SELECT COUNT(1) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
              (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
           FROM projects p
           WHERE p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
           ORDER BY p.created_at DESC`;

      const result = req.user.role === "admin"
        ? await pool.query(query)
        : await pool.query(query, [req.user.id]);

      return res.json(result.rows.map(sanitizeProject));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post(
    "/",
    requireAuth,
    checkRole("admin"),
    [
      body("name").trim().notEmpty().withMessage("Project name is required").isLength({ max: 80 }).withMessage("Project name must be 80 characters or fewer"),
      body("description").optional().isString(),
    ],
    handleValidation,
    async (req, res) => {
      const { name, description } = req.body;
      const now = new Date().toISOString();
      const projectId = uuidv4();

      try {
        await pool.query(
          `INSERT INTO projects (id, name, description, owner_id, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [projectId, name.trim(), description || null, req.user.id, now]
        );

        await pool.query(
          `INSERT INTO project_members (project_id, user_id, role, created_at)
           VALUES ($1, $2, 'admin', $3)`,
          [projectId, req.user.id, now]
        );

        return res.status(201).json({ id: projectId, name: name.trim(), description: description || null, owner_id: req.user.id, created_at: now });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.get("/:id", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const members = await getProjectMembers(req.project.id);
      const tasks = (await getProjectTasks(req.project.id)).map((task) => ({
        ...task,
        assignee: task.assignee_id
          ? { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email }
          : null,
      }));

      return res.json({ project: req.project, members, tasks });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post(
    "/:id/tasks",
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

          const membership = await getMemberStatus(req.project.id, assignee_id);
          if (!membership) {
            return res.status(400).json({ message: "Assignee must be a member of the project" });
          }
        }

        const taskId = uuidv4();
        const createdAt = new Date().toISOString();

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
            createdAt,
          ]
        );

        await pool.query(
          `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), req.project.id, req.user.id, `created task ${title.trim()}`, "task", taskId, createdAt]
        );

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
    requireProjectAdmin,
    [
      param("id").isUUID().withMessage("Invalid project ID"),
      body("name").optional().trim().notEmpty().withMessage("Project name is required").isLength({ max: 80 }).withMessage("Project name must be 80 characters or fewer"),
      body("description").optional().isString(),
    ],
    handleValidation,
    async (req, res) => {
      const { name, description } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) {
        values.push(name.trim());
        updates.push(`name = $${values.length}`);
      }
      if (description !== undefined) {
        values.push(description || null);
        updates.push(`description = $${values.length}`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      try {
        values.push(req.params.id);
        await pool.query(`UPDATE projects SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
        return res.json({ message: "Project updated" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.delete("/:id", requireAuth, requireProjectAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
      return res.json({ message: "Project deleted" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/:id/members", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const members = (await getProjectMembers(req.project.id)).map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        project_role: member.project_role,
      }));
      return res.json(members);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post(
    "/:id/members",
    requireAuth,
    requireProjectAdmin,
    [param("id").isUUID().withMessage("Invalid project ID"), body("email").isEmail().withMessage("Valid email is required")],
    handleValidation,
    async (req, res) => {
      try {
        const project = await getProjectById(req.params.id);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const user = await getUserByEmail(req.body.email);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const membership = await getMemberStatus(project.id, user.id);
        if (membership) {
          return res.status(400).json({ message: "User is already a project member" });
        }

        await pool.query(
          `INSERT INTO project_members (project_id, user_id, role, created_at)
           VALUES ($1, $2, 'member', $3)`,
          [project.id, user.id, new Date().toISOString()]
        );

        return res.status(201).json({ message: "Member added" });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.delete("/:id/members/:userId", requireAuth, requireProjectAdmin, [param("id").isUUID(), param("userId").isUUID()], handleValidation, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (project.owner_id === req.params.userId) {
        return res.status(400).json({ message: "Cannot remove project owner" });
      }

      const deletion = await pool.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [req.params.id, req.params.userId]);
      if (deletion.rowCount === 0) {
        return res.status(404).json({ message: "Member not found" });
      }

      return res.json({ message: "Member removed" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
