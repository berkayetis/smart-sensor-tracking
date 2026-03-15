export const CRITICAL_ENV_KEYS = [
  "JWT_SECRET",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "MQTT_URL",
  "MQTT_TLS_REJECT_UNAUTHORIZED",
  "MQTT_TLS_CA_PATH",
] as const;

export function validateCriticalEnvOrThrow(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = CRITICAL_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const mqttUrl = env.MQTT_URL!.trim().toLowerCase();
  if (!mqttUrl.startsWith("mqtts://")) {
    throw new Error(
      "Invalid configuration: MQTT_URL must use mqtts:// for TLS/SSL protection",
    );
  }

  const tlsRejectUnauthorized = env.MQTT_TLS_REJECT_UNAUTHORIZED!.trim().toLowerCase();
  if (tlsRejectUnauthorized !== "true") {
    throw new Error(
      "Invalid configuration: MQTT_TLS_REJECT_UNAUTHORIZED must be true",
    );
  }
}
