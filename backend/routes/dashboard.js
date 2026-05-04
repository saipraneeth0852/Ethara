const express = require("express");
const { requireAuth } = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  router.get("/", requireAuth, async (req, res) => {
    try {
      const isAdmin = req.user.role === "admin";
      const userId = req.user.id;

      const projectFilter = isAdmin
        ? ""
        : `WHERE p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;

      const countsQuery = `
        SELECT
           COUNT(t.id) AS total_tasks,
           SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) AS todo_count,
           SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count,
           SUM(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE THEN 1 ELSE 0 END) AS overdue_count
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         ${projectFilter}
      `;

      const countResult = isAdmin ? await pool.query(countsQuery) : await pool.query(countsQuery, [userId]);
      const countRow = countResult.rows[0];

      const tasksQuery = `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.project_id,
                u.name AS assignee_name, u.email AS assignee_email
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         JOIN projects p ON p.id = t.project_id
         WHERE t.assignee_id = $1
         ${isAdmin ? "" : "AND (p.owner_id = $2 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $2))"}
         ORDER BY t.due_date IS NULL, t.due_date ASC
         LIMIT 10
      `;

      const myTasksResult = isAdmin
        ? await pool.query(tasksQuery, [userId])
        : await pool.query(tasksQuery, [userId, userId]);
      const myTasks = myTasksResult.rows;

      const recentQuery = `
        SELECT p.id, p.name, p.description, p.owner_id, p.created_at,
                (SELECT COUNT(1) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
                (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id) AS task_count,
                (SELECT COUNT(1) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
         FROM projects p
         ${projectFilter}
         ORDER BY p.created_at DESC
         LIMIT 5
      `;

      const recentResult = isAdmin ? await pool.query(recentQuery) : await pool.query(recentQuery, [userId]);
      const recentProjects = recentResult.rows;

      return res.json({
        total_tasks: Number(countRow.total_tasks) || 0,
        todo_count: Number(countRow.todo_count) || 0,
        in_progress_count: Number(countRow.in_progress_count) || 0,
        done_count: Number(countRow.done_count) || 0,
        overdue_count: Number(countRow.overdue_count) || 0,
        my_tasks: myTasks.map((task) => ({
          ...task,
          assignee: task.assignee_name ? { name: task.assignee_name, email: task.assignee_email } : null,
        })),
        recent_projects: recentProjects,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
