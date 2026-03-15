# Mimari Tasarim

## Sistem Bilesenleri ve Sorumluluklar

| Bilesen | Sorumluluk |
|---|---|
| NestJS API (Controller katmani) | HTTP endpointleri, DTO validation, rol bazli erisim |
| `AuthModule` | Login, JWT olusturma, JWT dogrulama |
| `IamModule` | Sirket/kullanici yonetimi, rol ve cihaz yetkileri |
| `TelemetryModule` | MQTT ingest, InfluxDB yazma/okuma, sensör erisim kontrolu |
| `RealtimeModule` (`Socket.IO`) | Gercek zamanli sensor yayinlari ve oda aboneligi |
| `AnalyticsModule` | `viewed_logs` takibi, saatlik istatistik, log event sorgulama |
| `LoggingModule` | Structured JSONL log yazimi (`timestamp, level, context, event, actor, extra`) |
| `GlobalExceptionFilter` | Tek tip HTTP hata body standardi |
| PostgreSQL + Prisma | IAM ve davranis kayitlari (`User`, `Company`, `Sensor`, `LogViewEvent`, vb.) |
| InfluxDB | Zaman serisi telemetry verisi |
| Mosquitto (MQTT) | IoT telemetry giris kanali (TLS) |

## Ana Veri Akislari

### 1. MQTT Ingest Akisi (`subscribe -> validate -> persist -> realtime emit`)
1. IoT sensör MQTT broker'a telemetry payload gonderir.
2. `MqttIngestService` ilgili ingest topic'e abonedir.
3. Gelen payload JSON parse + DTO validation'dan gecer.
4. Gecerli veri `TelemetryService.ingestMetric` ile InfluxDB'ye yazilir.
5. `telemetry.ingested` event'i tetiklenir.
6. `RealtimeGateway`, ilgili `sensor:<sensorId>` odasina `sensor.update` event'i yollar.
7. Gecersiz payload veya ingest hatalari structured log event olarak kaydedilir.

### 2. Yetkilendirme Akisi (JWT + RBAC + sirket siniri)
1. Kullanici `POST /auth/login` ile JWT alir.
2. Korumali endpointlerde `JwtOnlyGuard` token'i dogrular ve `authContext` uretir.
3. `RolesGuard` endpointteki `@Roles(...)` kurallarini dogrular.
4. Domain seviyesinde ek yetki kontrolleri servis katmaninda uygulanir:
   - Company Admin sadece kendi sirketini yonetebilir.
   - User sadece kendi/izinli sensörleri gorebilir.
5. Yetki ihlalleri `403` doner ve audit log eventleri uretilir (`rbac_denied`, `iam_company_boundary_violation`, `telemetry_access_denied`).

### 3. Logging ve Kullanici Log-Ziyaret Akisi
1. Tum uygulama olaylari JSONL formatinda `logs/app.jsonl` dosyasina yazilir.
2. HTTP request ve exception olaylari otomatik loglanir.
3. Kullanici log ekrani davranisi `viewed_logs` olarak kaydedilir:
   - Manuel: `POST /logs/views`
   - Otomatik: `GET /logs/views/stats` ve `GET /logs/events`
4. `AnalyticsService`, `LogViewEvent` kayitlarindan saatlik yogunluk analizi uretir.
5. Log event sorgulama yalnizca `SYSTEM_ADMIN` rolune aciktir.

## Rol Matrisi

| Islem | SYSTEM_ADMIN | COMPANY_ADMIN | USER |
|---|---|---|---|
| Giris (`/auth/login`) | Evet | Evet | Evet |
| Sirket olusturma | Evet | Hayir | Hayir |
| Sirket/kullanici listeleme | Tum veriler | Kendi sirketi | Hayir |
| Rol guncelleme | Evet | Hayir | Hayir |
| Cihaz yetkisi atama | Tum kullanicilar | Kendi sirket kullanicilari | Hayir |
| Sensör olusturma | Evet | Kendi sirketi | Hayir |
| Sensör telemetry goruntuleme | Tum sensörler | Kendi sirket sensörleri | Sadece izinli sensörler |
| Log stats | Evet | Kendi sirket istatistigi | Hayir |
| Log events | Evet | Hayir | Hayir |

## Guvenlik Kararlari

- Kimlik dogrulama modeli: **JWT-only**
- MQTT baglantisi: `mqtts://` zorunlu, CA sertifikasi zorunlu, `MQTT_TLS_REJECT_UNAUTHORIZED=true`
- Global rate limiting: uygulama capinda aktif (`120 req / 60 sn`)
- Rol bazli yetkilendirme: Guard + servis katmani ikili koruma
- Log erisimi: `GET /logs/events` yalnizca `SYSTEM_ADMIN`

## Mimari Kararlar (Kisa ADR Ozeti)

1. Realtime kanal olarak WebSocket secildi.
- Neden: Browser istemciler icin sade baglanti modeli ve oda bazli yayin.
- Tradeoff: MQTT client'lar icin ayrica istemci entegrasyonu gerekebilir.

2. MQTT yalnizca ingest amaciyla kullanildi.
- Neden: Akisi tek yone indirip backend karmasikligini azaltmak.
- Tradeoff: MQTT tarafinda "processed topic" uzerinden dagitim yapilmiyor.

3. Telemetry verisi InfluxDB'de, IAM verisi PostgreSQL'de tutuldu.
- Neden: Zaman serisi sorgulari ile iliskisel yonetim verilerinin ayri ihtiyaclari var.
- Tradeoff: Iki farkli veritabani operasyonel yuk getirir.

4. Log kayitlari dosya tabanli JSONL + query endpoint modeliyle sunuldu.
- Neden: Basit, izlenebilir, case kapsaminda hizli.
- Tradeoff: Buyuk hacimde merkezi log altyapisina gecis ihtiyaci dogabilir.
