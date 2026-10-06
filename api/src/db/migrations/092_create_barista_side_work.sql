CREATE TABLE IF NOT EXISTS barista_side_work_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  instructions VARCHAR(500) NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_side_work_due (tenant_id, scheduled_date, scheduled_time, is_active),
  CONSTRAINT fk_side_work_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_side_work_creator FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS barista_side_work_completions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  barista_id INT NOT NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by_admin_user_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_side_work_completion (task_id),
  KEY idx_side_work_completion_barista (barista_id, completed_at),
  CONSTRAINT fk_side_work_completion_task FOREIGN KEY (task_id) REFERENCES barista_side_work_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_side_work_completion_barista FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_side_work_completion_recorder FOREIGN KEY (recorded_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
