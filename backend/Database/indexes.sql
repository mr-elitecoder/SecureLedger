-- ============================================================
-- INDEXES — Performance ke liye
-- ============================================================

CREATE INDEX idx_txn_sender ON transactions (sender_id);

CREATE INDEX idx_txn_receiver ON transactions (receiver_id);

CREATE INDEX idx_txn_created ON transactions (created_at);

CREATE INDEX idx_fraud_user ON fraud_alerts (user_id);

CREATE INDEX idx_audit_actor ON audit_log (actor_id);

CREATE INDEX idx_audit_created ON audit_log (created_at);