-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "isCombined" BOOLEAN NOT NULL DEFAULT false,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "flexDays" INTEGER NOT NULL DEFAULT 0,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "nearbyAirports" BOOLEAN NOT NULL DEFAULT false,
    "targetPriceBrl" REAL NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" DATETIME,
    "lastBestPrice" REAL,
    "notifiedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestPriceBrl" REAL NOT NULL,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "carrierCode" TEXT,
    "raw" TEXT,
    CONSTRAINT "PriceHistory_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Alert_active_idx" ON "Alert"("active");

-- CreateIndex
CREATE INDEX "PriceHistory_alertId_checkedAt_idx" ON "PriceHistory"("alertId", "checkedAt");

-- CreateIndex
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");
