CREATE TABLE IF NOT EXISTS offers (
    id              SERIAL PRIMARY KEY,
    label           VARCHAR(100) NOT NULL,
    face_value      INTEGER NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    price           INTEGER NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO offers (label, face_value, discount_percent, price)
VALUES
    ('Ksh 20 Airtime',  20, 5.00, 19),
    ('Ksh 50 Airtime',  50, 5.00, 48),
    ('Ksh 100 Airtime', 100, 5.00, 95),
    ('Ksh 200 Airtime', 200, 5.00, 190),
    ('Ksh 500 Airtime', 500, 5.00, 475),
    ('Ksh 1000 Airtime', 1000, 5.00, 950)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS transactions (
    id                      BIGSERIAL PRIMARY KEY,
    merchant_request_id     VARCHAR(100),
    checkout_request_id     VARCHAR(100) UNIQUE,
    payer_phone             VARCHAR(15) NOT NULL,
    recipient_phone         VARCHAR(15) NOT NULL,
    face_value              INTEGER NOT NULL,
    amount_charged          INTEGER NOT NULL,
    offer_id                INTEGER REFERENCES offers(id),
    mpesa_status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    mpesa_receipt_number    VARCHAR(50),
    mpesa_result_code       INTEGER,
    mpesa_result_desc       TEXT,
    mpesa_raw_callback      JSONB,
    at_status                VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
    at_request_id            VARCHAR(100),
    at_response               JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id ON transactions (checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_status ON transactions (mpesa_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
