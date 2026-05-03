-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "HotelRole" AS ENUM ('MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "CostNature" AS ENUM ('RECURRING', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "AmountType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'HU',
    "baseCurrency" TEXT NOT NULL DEFAULT 'HUF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelUser" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HotelRole" NOT NULL DEFAULT 'MANAGER',

    CONSTRAINT "HotelUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "listPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "occupancyPct" DOUBLE PRECISION NOT NULL,
    "adr" INTEGER NOT NULL,
    "fbRevenue" INTEGER NOT NULL DEFAULT 0,
    "spaRevenue" INTEGER NOT NULL DEFAULT 0,
    "otherRevenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cost" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CostType" NOT NULL,
    "nature" "CostNature" NOT NULL,
    "amountType" "AmountType" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "amount" INTEGER,
    "percentage" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRule" (
    "id" TEXT NOT NULL,
    "costId" TEXT NOT NULL,
    "occupancyFrom" DOUBLE PRECISION NOT NULL,
    "occupancyTo" DOUBLE PRECISION,
    "extraStaffCount" INTEGER NOT NULL,
    "dailyRate" INTEGER NOT NULL,

    CONSTRAINT "StaffRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSetting" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "amountPerPerson" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,

    CONSTRAINT "LabSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPickup" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "arrivalDate" DATE NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "roomsSold" INTEGER NOT NULL,
    "revenue" INTEGER NOT NULL,
    "adr" INTEGER NOT NULL,
    "importBatchId" TEXT NOT NULL,

    CONSTRAINT "HistoricalPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "fromCcy" TEXT NOT NULL,
    "toCcy" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MNB',

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "HotelUser_hotelId_userId_key" ON "HotelUser"("hotelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_scenarioId_roomTypeId_date_key" ON "PlanDay"("scenarioId", "roomTypeId", "date");

-- CreateIndex
CREATE INDEX "HistoricalPickup_hotelId_arrivalDate_idx" ON "HistoricalPickup"("hotelId", "arrivalDate");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPickup_hotelId_arrivalDate_snapshotDate_key" ON "HistoricalPickup"("hotelId", "arrivalDate", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_hotelId_fromCcy_toCcy_date_key" ON "ExchangeRate"("hotelId", "fromCcy", "toCcy", "date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelUser" ADD CONSTRAINT "HotelUser_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelUser" ADD CONSTRAINT "HotelUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRule" ADD CONSTRAINT "StaffRule_costId_fkey" FOREIGN KEY ("costId") REFERENCES "Cost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSetting" ADD CONSTRAINT "LabSetting_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalPickup" ADD CONSTRAINT "HistoricalPickup_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
