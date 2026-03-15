# Deployment Rehberi (Docker Compose - Local + Staging)

## Onkosullar

- Docker Engine ve Docker Compose
- Proje kok dizininde `.env` dosyasi
- MQTT TLS sertifikalari (`docker/mosquitto/certs/ca.crt`, `server.crt`, `server.key`)
- Sertifika uretimi icin script: `scripts/generate-mqtt-certs.ps1`

## Guvenlik Kurali

- Secret degerler Docker Compose dosyasina literal olarak yazilmaz.
- Tum secretlar yalnizca `.env` dosyasindan okunur.
- `docker compose config` calistiginda eksik zorunlu degisken varsa komut fail etmelidir.

## Gerekli Environment Degiskenleri

`.env.example` ile birebir uyumlu degiskenler:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `RUN_DB_SEED` (opsiyonel, varsayilan `false`)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `INFLUX_URL`
- `DOCKER_INFLUXDB_INIT_MODE`
- `DOCKER_INFLUXDB_INIT_USERNAME`
- `DOCKER_INFLUXDB_INIT_PASSWORD`
- `INFLUX_TOKEN`
- `INFLUX_ORG`
- `INFLUX_BUCKET`
- `MQTT_URL`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_INGEST_TOPIC`
- `MQTT_PUBLISH_TOPIC_TEMPLATE`
- `MQTT_PUBLISH_QOS`
- `MQTT_PUBLISH_RETAIN`
- `MQTT_TLS_REJECT_UNAUTHORIZED`
- `MQTT_TLS_CA_PATH`

Notlar:

- `MQTT_URL` mutlaka `mqtts://` ile baslamalidir.
- `MQTT_TLS_REJECT_UNAUTHORIZED=true` olmali.
- `MQTT_TLS_CA_PATH` gecerli bir dosyayi gostermelidir.
- `RUN_DB_SEED=true` ise app container acilisinda migration sonrasinda otomatik `prisma seed` calisir.
- Mosquitto `passwordfile` dosyasi container baslangicinda runtime uretilir.
- Private key dosyalari (`*.key`) repoya alinmaz; local/development ortaminda yeniden uretilir.

## Local Kurulum (Docker Compose)

1. MQTT sertifikalarini localde uret:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-mqtt-certs.ps1
```

2. Konfig dogrulama:

```bash
docker compose config
```

3. Ortami ayaga kaldir:

```bash
docker compose up -d --build
```

4. Servisleri kontrol et:

```bash
docker compose ps
```

5. API dogrulama:

```bash
curl http://localhost:3000/docs-json
```

6. Login smoke testi:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOOTSTRAP_ADMIN_EMAIL\",\"password\":\"$BOOTSTRAP_ADMIN_PASSWORD\"}"
```

7. MQTT ingest smoke testi (TLS):

```bash
mosquitto_pub -h localhost -p 8883 \
  --cafile ./docker/mosquitto/certs/ca.crt \
  -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "$MQTT_INGEST_TOPIC" \
  -m "{\"sensor_id\":\"temp_sensor_01\",\"timestamp\":1710772800,\"temperature\":25.4,\"humidity\":55.2}"
```

## Staging Akisi (Docker Compose)

1. Staging env dosyasi olustur (`.env.staging`):

- Guclu `JWT_SECRET`
- Gercek staging DB/Influx/MQTT bilgileri
- `NODE_ENV=production`

2. Staging deploy:

```bash
docker compose --env-file .env.staging config
docker compose --env-file .env.staging up -d --build
```

3. Migration uygulama:

```bash
docker compose --env-file .env.staging run --rm app npm run prisma:deploy
```

4. Log kontrol:

```bash
docker compose --env-file .env.staging logs -f app
```

## Dogrulama Checklist

- API endpointleri erisilebilir mi?
- MQTT payload ingest ediliyor mu?
- InfluxDB'ye telemetry yaziliyor mu?
- WebSocket `sensor.update` event'i aliniyor mu?
- RBAC kurallari dogru mu (`401/403/200`)?
- Log endpointlerinde otomatik `viewed_logs` kaydi olusuyor mu?

## Sorun Giderme

| Sorun | Olasi Neden | Cozum |
|---|---|---|
| `docker compose config` fail oluyor | Zorunlu env degiskenlerinden biri eksik | `.env.example` ile `.env` dosyasini satir satir karsilastir |
| Uygulama acilmiyor, MQTT hatasi | `MQTT_URL` `mqtts://` degil veya CA yolu gecersiz | `.env` degerlerini kontrol et, CA dosya yolunu dogrula |
| `401 Unauthorized` | JWT yok/gecersiz | `Authorization: Bearer <token>` header'ini dogrula |
| `403 Forbidden` | Rol veya sirket siniri ihlali | Kullanici rolunu ve kaynak sirket bagliligini kontrol et |
| Telemetry history bos | Influx baglanti/token sorunu veya veri yok | `INFLUX_*` degiskenlerini ve ingest akis loglarini kontrol et |

## Operasyon Notlari

- App log dosyasi: `logs/app.jsonl`
- Swagger: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
