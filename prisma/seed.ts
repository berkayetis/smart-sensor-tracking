import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COMPANY_NAMES = {
  primary: "Acme Manufacturing",
  secondary: "Beta Industries",
};

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!BOOTSTRAP_ADMIN_EMAIL || BOOTSTRAP_ADMIN_EMAIL.trim().length === 0) {
  throw new Error("Missing required env: BOOTSTRAP_ADMIN_EMAIL");
}

if (!BOOTSTRAP_ADMIN_PASSWORD || BOOTSTRAP_ADMIN_PASSWORD.trim().length === 0) {
  throw new Error("Missing required env: BOOTSTRAP_ADMIN_PASSWORD");
}

const USER_EMAILS = {
  systemAdmin: BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
  companyAdmin: "admin@acme.local",
  user: "user@acme.local",
  secondaryAdmin: "admin@beta.local",
};

const USER_PASSWORDS = {
  systemAdmin: BOOTSTRAP_ADMIN_PASSWORD,
  companyAdmin: "CompanyAdmin123!",
  user: "User123!",
  secondaryAdmin: "CompanyAdmin123!",
};

async function upsertUser(params: {
  email: string;
  password: string;
  role: Role;
  companyId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.upsert({
    where: { email: params.email.toLowerCase() },
    update: {
      passwordHash,
      role: params.role,
      companyId: params.companyId ?? null,
      isActive: true,
    },
    create: {
      email: params.email.toLowerCase(),
      passwordHash,
      role: params.role,
      companyId: params.companyId ?? null,
      isActive: true,
    },
  });
}

async function main() {
  const primaryCompany = await prisma.company.upsert({
    where: { name: COMPANY_NAMES.primary },
    update: {},
    create: { name: COMPANY_NAMES.primary },
  });

  const secondaryCompany = await prisma.company.upsert({
    where: { name: COMPANY_NAMES.secondary },
    update: {},
    create: { name: COMPANY_NAMES.secondary },
  });

  const systemAdmin = await upsertUser({
    email: USER_EMAILS.systemAdmin,
    password: USER_PASSWORDS.systemAdmin,
    role: Role.SYSTEM_ADMIN,
    companyId: null,
  });

  const companyAdmin = await upsertUser({
    email: USER_EMAILS.companyAdmin,
    password: USER_PASSWORDS.companyAdmin,
    role: Role.COMPANY_ADMIN,
    companyId: primaryCompany.id,
  });

  const user = await upsertUser({
    email: USER_EMAILS.user,
    password: USER_PASSWORDS.user,
    role: Role.USER,
    companyId: primaryCompany.id,
  });

  await upsertUser({
    email: USER_EMAILS.secondaryAdmin,
    password: USER_PASSWORDS.secondaryAdmin,
    role: Role.COMPANY_ADMIN,
    companyId: secondaryCompany.id,
  });

  await prisma.sensor.upsert({
    where: { id: "temp_sensor_01" },
    update: { name: "Factory Floor Temperature", companyId: primaryCompany.id },
    create: {
      id: "temp_sensor_01",
      name: "Factory Floor Temperature",
      companyId: primaryCompany.id,
    },
  });

  await prisma.sensor.upsert({
    where: { id: "humid_sensor_01" },
    update: { name: "Factory Floor Humidity", companyId: primaryCompany.id },
    create: {
      id: "humid_sensor_01",
      name: "Factory Floor Humidity",
      companyId: primaryCompany.id,
    },
  });

  await prisma.sensor.upsert({
    where: { id: "temp_sensor_99" },
    update: { name: "Secondary Plant Temperature", companyId: secondaryCompany.id },
    create: {
      id: "temp_sensor_99",
      name: "Secondary Plant Temperature",
      companyId: secondaryCompany.id,
    },
  });

  await prisma.userDevicePermission.createMany({
    data: [
      { userId: user.id, sensorId: "temp_sensor_01" },
      { userId: companyAdmin.id, sensorId: "temp_sensor_01" },
      { userId: companyAdmin.id, sensorId: "humid_sensor_01" },
    ],
    skipDuplicates: true,
  });

  const existingLogEvents = await prisma.logViewEvent.count({
    where: {
      userId: user.id,
      action: "viewed_logs",
    },
  });

  if (existingLogEvents === 0) {
    const now = Date.now();
    await prisma.logViewEvent.createMany({
      data: [
        {
          userId: user.id,
          action: "viewed_logs",
          timestamp: new Date(now - 60 * 60 * 1000),
        },
        {
          userId: user.id,
          action: "viewed_logs",
          timestamp: new Date(now - 30 * 60 * 1000),
        },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed tamamlandi.");
  // eslint-disable-next-line no-console
  console.log(`System Admin: ${systemAdmin.email}`);
  // eslint-disable-next-line no-console
  console.log(`Company Admin: ${USER_EMAILS.companyAdmin}`);
  // eslint-disable-next-line no-console
  console.log(`User: ${USER_EMAILS.user}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seed hatasi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
