# API Endpointleri Rehberi

Swagger:
- UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

Auth header (korumali endpointler):
- `Authorization: Bearer <jwt>`

## HTTP Endpointleri

| Method | Path | Auth | Rol | Aciklama | Request | Response | Hata Kodlari |
|---|---|---|---|---|---|---|---|
| `POST` | `/auth/login` | Yok | Public | Kullanici girisi yapar ve JWT dondurur. | `{"email":"admin@acme.local","password":"CompanyAdmin123!"}` | `{"accessToken":"<jwt>"}` | `401` gecersiz kimlik bilgisi, `400` validation |
| `GET` | `/companies` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Sirketleri listeler. Company Admin sadece kendi sirketini gorur. | Body yok | `[{ "id":"...", "name":"Acme Manufacturing", "createdAt":"..." }]` | `401`, `403` |
| `POST` | `/companies` | JWT | `SYSTEM_ADMIN` | Yeni sirket olusturur. | `{"name":"Gamma Plant"}` | `{ "id":"...", "name":"Gamma Plant", "createdAt":"..." }` | `401`, `403`, `400` |
| `GET` | `/users` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Kullanici listeler. Company Admin kendi sirketini gorur, `SYSTEM_ADMIN` kayitlari non-system kullanicilar icin gorunmezdir. | Body yok | `[{ "id":"...", "email":"...", "role":"USER", "companyId":"..." }]` | `401`, `403` |
| `POST` | `/users` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Kullanici olusturur. Company Admin yalnizca `USER` olusturabilir. | `{"email":"user@x.local","password":"Strong123!","role":"USER","companyId":"..."}` | `{ "id":"...", "email":"...", "role":"USER", "companyId":"..." }` | `401`, `403`, `400` |
| `PATCH` | `/users/:id/role` | JWT | `SYSTEM_ADMIN` | Kullanici rolunu gunceller. | `{"role":"COMPANY_ADMIN"}` | `{ "id":"...", "email":"...", "role":"COMPANY_ADMIN", "companyId":"..." }` | `401`, `403`, `404`, `400` |
| `POST` | `/users/:id/device-permissions` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Kullaniciya sensör yetkileri atar. Company Admin sirket disi sensör atayamaz. | `{"sensorIds":["temp_sensor_01","humid_sensor_01"]}` | `[{ "sensorId":"temp_sensor_01","assignedAt":"..." }]` | `401`, `403`, `404`, `400` |
| `GET` | `/users/:id/device-permissions` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN`, `USER` | Kullanici sensör yetkilerini getirir. `USER` sadece kendi kaydini gorebilir. | Body yok | `[{ "sensorId":"temp_sensor_01","assignedAt":"..." }]` | `401`, `403`, `404` |
| `POST` | `/sensors` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Sensör kaydi olusturur/gunceller (upsert). | `{"id":"temp_sensor_01","name":"Factory Temp","companyId":"..."}` | `{ "id":"temp_sensor_01","name":"Factory Temp","companyId":"..." }` | `401`, `403`, `400` |
| `GET` | `/sensors/:id/latest` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN`, `USER` | Sensörun son telemetry kaydini getirir. | Body yok | `{ "sensorId":"temp_sensor_01","timestamp":"...","temperature":25.4,"humidity":55.2 }` veya `null` | `401`, `403`, `404` |
| `GET` | `/sensors/:id/history` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN`, `USER` | Tarih araliginda telemetry listesi getirir. | Query: `from`, `to` ISO string | `[{ "sensorId":"...","timestamp":"...","temperature":...,"humidity":... }]` | `401`, `403`, `404`, `400` |
| `POST` | `/logs/views` | JWT | Tum giris yapmis roller | Manuel log sayfasi ziyaret kaydi olusturur. | Body yok | `{ "user_id":"user_123", "timestamp":1710772800, "action":"viewed_logs" }` | `401` |
| `GET` | `/logs/views/stats` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Saatlik log-goruntuleme istatistigi doner. Bu endpoint cagrildiginda otomatik `viewed_logs` kaydi da olusur. | Query: `from`, `to`, `bucket=hour` | `[{ "hourStart":"2026-03-15T10:00:00.000Z", "count":12 }]` | `401`, `403`, `400` |
| `GET` | `/logs/views/prediction` | JWT | `SYSTEM_ADMIN`, `COMPANY_ADMIN` | Son 24 saat log goruntuleme davranisina gore bir sonraki saat icin basit tahmin doner. Bu endpoint cagrildiginda otomatik `viewed_logs` kaydi da olusur. | Body yok | `{ "windowHours":24, "last24hTotalViews":48, "last24hHourlyAverage":2, "predictedNextHourViews":2, "generatedAt":"2026-03-15T12:00:00.000Z" }` | `401`, `403` |
| `GET` | `/logs/events` | JWT | `SYSTEM_ADMIN` | Uygulama JSON log olaylarini filtreleyerek getirir. Bu endpoint cagrildiginda otomatik `viewed_logs` kaydi da olusur. | Query: `from`, `to`, `level`, `event`, `limit` | `[{ "timestamp":"...","level":"warn","context":"Auth","event":"rbac_denied","actor":{"userId":"...","role":"...","companyId":"..."},"extra":{...} }]` | `401`, `403`, `400` |

## Realtime (WebSocket)

- Namespace: `/realtime`
- Auth: JWT handshake zorunlu (`auth.token` veya `Authorization: Bearer <jwt>`)
- Oda modeli: `sensor:<sensorId>`

Client -> Server eventleri:
- `sensor.subscribe` `{ "sensorId": "temp_sensor_01" }`
- `sensor.unsubscribe` `{ "sensorId": "temp_sensor_01" }`

Server -> Client eventleri:
- `sensor.update` `{ "sensorId":"...","timestamp":"...","temperature":...,"humidity":... }`
- `sensor.error` `{ "type":"auth_failed|subscribe_denied", "message":"..." }`

Yetki:
- Abonelikte sensör erisimi `TelemetryService.ensureSensorAccess` ile kontrol edilir.
- Yetkisiz abonelikte socket baglantisi korunur, ilgili event icin `success:false` doner ve `sensor.error` yayinlanir.

## Standart Hata Formati

Tum HTTP hatalarinda tek tip JSON doner:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "timestamp": "2026-03-14T12:00:00.000Z",
  "path": "/sensors/bad/latest",
  "method": "GET"
}
```
