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

module.exports = (db) => {
  const router = express.Router();
  const getProjectById = db.prepare("SELECT * FROM projects WHERE id = ?");
  const getMemberStatus = db.prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?");
  const getUserByEmail = db.prepare("SELECT id, name, email, role FROM users WHERE lower(email) = lower(?)");
  const getUserById = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?");
  const getProjectMembers = db.prepare(
    `SELECT u.id, u.name, u.email, u.role, pm.role as project_role
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?`
  );
  const getProjectTasks = db.prepare(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.assignee_id,
            u.name AS assignee_name, u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.project_id = ?`
  );

  function sanitizeProject(project) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      owner_id: project.owner_id,
      created_at: project.created_at,
      member_count: project.member_count,
      task_count: project.task_count,
      done_count: project.done_count,
    };
  }

  function requireProjectAccess(req, res, next) {
    const project = getProjectById.get(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (req.user.role === "admin") {
      req.project = project;
      return next();
    }

    const membership = getMemberStatus.get(project.id, req.user.id);
    if (!membership && project.owner_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.project = project;
    req.projectMembership = membership;
    return next();
  }

  function requireProjectAdmin(req, res, next) {
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

  router.get("/", requireAuth, (req, res) => {
    let projects;
    if (req.user.role === "admin") {
      projects = db
        .prepare(
          `SELECT p.*, 
            (SELECT COUNT(1) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
            (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
          FROM projects p
          ORDER BY p.created_at DESC`
        )
        .all();
    } else {
      projects = db
        .prepare(
          `SELECT p.*, 
            (SELECT COUNT(1) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
            (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
          FROM projects p
          WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
          ORDER BY p.created_at DESC`
        )
        .all(req.user.id, req.user.id);
    }

    return res.json(projects.map(sanitizeProject));
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
    (req, res) => {
      const { name, description } = req.body;
      const now = new Date().toISOString();
      const projectId = uuidv4();

      db.prepare(
        `INSERT INTO projects (id, name, description, owner_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(projectId, name.trim(), description || null, req.user.id, now);

      db.prepare(
        `INSERT INTO project_members (project_id, user_id, role, created_at)
         VALUES (?, ?, 'admin', ?)`
      ).run(projectId, req.user.id, now);

      return res.status(201).json({ id: projectId, name: name.trim(), description: description || null, owner_id: req.user.id, created_at: now });
    }
  );

  router.get("/:id", requireAuth, requireProjectAccess, (req, res) => {
    const project = req.project;
    const members = getProjectMembers.all(project.id);
    const tasks = getProjectTasks.all(project.id).map((task) => ({
      ...task,
      assignee: task.assignee_id
        ? { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email }
        : null,
    }));

    return res.json({ project, members, tasks });
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
    (req, res) => {
      const { title, description, priority, due_date, assignee_id } = req.body;
      if (assignee_id) {
        const assignee = getUserById.get(assignee_id);
        if (!assignee) {
          return res.status(404).json({ message: "Assignee not found" });
        }
        const membership = getMemberStatus.get(req.project.id, assignee_id);
        if (!membership) {
          return res.status(400).json({ message: "Assignee must be a member of the project" });
        }
      }

      const taskId = uuidv4();
      db.prepare(
        `INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, assignee_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
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

      db.prepare(
        `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), req.project.id, req.user.id, `created task ${title.trim()}`, "task", taskId, new Date().toISOString());

      return res.status(201).json({ message: "Task created", id: taskId });
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
    (req, res) => {
      const { name, description } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push("name = ?");
        values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push("description = ?");
        values.push(description || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      values.push(req.params.id);
      db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      return res.json({ message: "Project updated" });
    }
  );

  router.delete("/:id", requireAuth, requireProjectAdmin, (req, res) => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    return res.json({ message: "Project deleted" });
  });

  router.get("/:id/members", requireAuth, requireProjectAccess, (req, res) => {
    const members = getProjectMembers.all(req.project.id).map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      project_role: member.project_role,
    }));
    return res.json(members);
  });

  router.post(
    "/:id/members",
    requireAuth,
    requireProjectAdmin,
    [param("id").isUUID().withMessage("Invalid project ID"), body("email").isEmail().withMessage("Valid email is required")],
    handleValidation,
    (req, res) => {
      const project = getProjectById.get(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const user = getUserByEmail.get(req.body.email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const membership = getMemberStatus.get(project.id, user.id);
      if (membership) {
        return res.status(400).json({ message: "User is already a project member" });
      }

      db.prepare(
        `INSERT INTO project_members (project_id, user_id, role, created_at)
         VALUES (?, ?, 'member', ?)`
      ).run(project.id, user.id, new Date().toISOString());

      return res.status(201).json({ message: "Member added" });
    }
  );

  router.delete("/:id/members/:userId", requireAuth, requireProjectAdmin, [param("id").isUUID(), param("userId").isUUID()], handleValidation, (req, res) => {
    const project = getProjectById.get(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.owner_id === req.params.userId) {
      return res.status(400).json({ message: "Cannot remove project owner" });
    }

    const deletion = db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(req.params.id, req.params.userId);
    if (deletion.changes === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    return res.json({ message: "Member removed" });
  });

  return router;
};
