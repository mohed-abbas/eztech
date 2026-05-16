-- enforce the "one active delivery per rider" invariant at the database level
-- the application-level check is in a serializable transaction; this index is defense-in-depth
CREATE UNIQUE INDEX IF NOT EXISTS "Order_one_active_delivery_per_rider"
  ON "Order" ("riderId")
  WHERE "status" IN ('rider_assigned', 'at_warehouse', 'picked_up', 'in_transit');

-- add a real foreign key for Return.orderId; on parent delete we null it out rather than cascade
-- (returns can outlive the original order in some flows)
ALTER TABLE "Return"
  ADD CONSTRAINT "Return_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Return_orderId_idx" ON "Return" ("orderId");
