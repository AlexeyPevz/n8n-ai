# Security

## Principles
- Credentials-only: ассистент оперирует credentialRef, секреты недоступны.
- На клиенте/в логах — дедупликация и редакция PII.

## Reporting
- Уязвимости сообщать на security@your-org.com (PGP ключ в /docs/PGP.asc).
- SLA ответа: 72 часа.

## Data handling
- Retention аудита: 90 дней (настраиваемо).
- Логи: без значений секретов; promptHash/diffHash вместо полного текста.
