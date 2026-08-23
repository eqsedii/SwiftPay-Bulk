CREATE TABLE IF NOT EXISTS settings (
    id                 SMALLINT PRIMARY KEY DEFAULT 1,
    discount_percent   NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    service_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    min_float_threshold NUMERIC(10,2) NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO settings (id, discount_percent, service_enabled, min_float_threshold)
VALUES (1, 5.00, TRUE, 0)
ON CONFLICT (id) DO NOTHING;
