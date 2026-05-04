const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

async function seedDatabase(pool) {
  const result = await pool.query("SELECT COUNT(1) as count FROM users");
  const userCount = result.rows[0].count;
  if (userCount > 0) {
    return;
  }

  const now = new Date().toISOString();
  const adminId = uuidv4();
  const memberId = uuidv4();
  const projectId = uuidv4();

  const adminHash = bcrypt.hashSync("Admin1234", 10);
  const memberHash = bcrypt.hashSync("Member1234", 10);

  const tasks = [
    {
      id: uuidv4(),
      title: "Kick off website redesign",
      description: "Create the initial wireframe and review with stakeholders.",
      status: "todo",
      priority: "high",
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignee_id: adminId,
      created_by: adminId,
      created_at: now,
    },
    {
      id: uuidv4(),
      title: "Review homepage content",
      description: "Collect feedback and align the hero copy with marketing.",
      status: "in_progress",
      priority: "medium",
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignee_id: memberId,
      created_by: adminId,
      created_at: now,
    },
    {
      id: uuidv4(),
      title: "Update design system",
      description: "Add the latest button and form styles into the shared library.",
      status: "done",
      priority: "low",
      due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignee_id: memberId,
      created_by: adminId,
      created_at: now,
    },
    {
      id: uuidv4(),
      title: "Prepare stakeholder demo",
      description: "Build the demo environment and review the acceptance criteria.",
      status: "todo",
      priority: "medium",
      due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignee_id: adminId,
      created_by: adminId,
      created_at: now,
    },
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, "Admin User", "admin@taskflow.com", adminHash, "admin", now]
    );

    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [memberId, "Team Member", "member@taskflow.com", memberHash, "member", now]
    );

    await client.query(
      `INSERT INTO projects (id, name, description, owner_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, "Website Redesign", "A complete redesign of the marketing website.", adminId, now]
    );

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4)`,
      [projectId, adminId, "admin", now]
    );

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4)`,
      [projectId, memberId, "member", now]
    );

    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, assignee_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          task.id,
          task.title,
          task.description,
          task.status,
          task.priority,
          task.due_date,
          projectId,
          task.assignee_id,
          task.created_by,
          task.created_at,
        ]
      );

      await client.query(
        `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), projectId, adminId, `created task ${task.title}`, "task", task.id, now]
      );
    }

    await client.query(
      `INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), projectId, adminId, "seeded project", "project", projectId, now]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seedDatabase };
