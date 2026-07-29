# Guía: Subir una Nueva App al VPS

Seguí estos pasos en orden cada vez que querés agregar una nueva app al servidor.

---

## Paso 0 — Elegir puertos libres

Antes de empezar, decidí qué puertos vas a usar. Verificá cuáles están ocupados:

```bash
netstat -tlpn | grep LISTEN
pm2 list
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Puertos actualmente en uso (actualizar al agregar cada app):**
| Puerto | Quién lo usa        |
|--------|---------------------|
| 80/443 | Nginx               |
| 3000   | profly-api          |
| 3001   | profly-web          |
| 3006   | arai                |
| 5432   | sgo-db              |
| 5433   | arai-db (fix)       |
| 5435   | estudio_ferrer_db   |
| 5436   | cravero-db          |

Elegí un puerto para la app (ej: `3007`) y uno para la DB (ej: `5437`).

---

## Paso 1 — Clonar el repositorio

```bash
# Crear carpeta y clonar
mkdir -p /root/<nombre>
git clone https://github.com/facun3625/<repo>.git /root/<nombre>/<nombre>
cd /root/<nombre>/<nombre>
```

---

## Paso 2 — Crear la base de datos Docker

Siempre con puerto mapeado al host para evitar problemas de IP:

```bash
docker run -d \
  --name <nombre>-db \
  -p <PUERTO_DB>:5432 \
  -e POSTGRES_USER=<nombre>_user \
  -e POSTGRES_PASSWORD=<password_segura> \
  -e POSTGRES_DB=<nombre>_db \
  -v <nombre>_pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine
```

Verificar que levantó:
```bash
docker ps | grep <nombre>-db
```

---

## Paso 3 — Crear el archivo .env

```bash
cp .env.example .env   # si existe
nano .env              # o vim .env
```

La `DATABASE_URL` debe usar `localhost` y el puerto mapeado:
```
DATABASE_URL="postgresql://<nombre>_user:<password>@localhost:<PUERTO_DB>/<nombre>_db?schema=public"
PORT=<PUERTO_APP>
```

---

## Paso 4 — Instalar, migrar y buildear

```bash
cd /root/<nombre>/<nombre>

npm install

# Sincronizar schema con la base de datos
npx prisma db push

# Buildear la app
npm run build
```

---

## Paso 5 — Registrar en PM2

```bash
PORT=<PUERTO_APP> pm2 start npm --name "<nombre>" -- start

# Guardar para que sobreviva reinicios
pm2 save
```

Verificar que está corriendo:
```bash
pm2 status
pm2 logs <nombre> --lines 20 --nostream
```

---

## Paso 6 — Configurar Nginx

Crear el bloque de configuración:

```bash
nano /etc/nginx/sites-available/<dominio>
```

Pegar esta plantilla:
```nginx
server {
    listen 80;
    server_name <dominio.com> www.<dominio.com>;

    location / {
        proxy_pass http://localhost:<PUERTO_APP>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 50M;
}
```

Activar el sitio:
```bash
ln -s /etc/nginx/sites-available/<dominio> /etc/nginx/sites-enabled/

# Verificar config
nginx -t

# Aplicar
sudo systemctl reload nginx
```

---

## Paso 7 — SSL con Let's Encrypt (HTTPS)

```bash
certbot --nginx -d <dominio.com> -d www.<dominio.com>
```

Certbot edita el nginx automáticamente. Verificar que quedó bien:
```bash
nginx -t && sudo systemctl reload nginx
```

---

## Paso 8 — Verificación final

```bash
# App corriendo
pm2 status

# Logs sin errores
pm2 logs <nombre> --lines 30 --nostream

# DB accesible
curl http://localhost:<PUERTO_APP>/api/health  # si existe endpoint de health

# Desde afuera: abrir https://<dominio.com> en el navegador
```

---

## Actualizaciones futuras de la app

```bash
cd /root/<nombre>/<nombre>
git pull origin main
npx prisma db push   # solo si hubo cambios en el schema
npm run build
pm2 restart <nombre>
```

---

## Troubleshooting

**App no levanta:**
```bash
pm2 logs <nombre> --lines 50
```

**DB no conecta:**
```bash
docker ps | grep <nombre>-db
docker inspect <nombre>-db | grep IPAddress
# Verificar que DATABASE_URL usa localhost:<PUERTO_DB> y no la IP interna
```

**Nginx error 502:**
```bash
pm2 status           # verificar que la app está online
pm2 restart <nombre>
sudo systemctl reload nginx
```

**Sin espacio en disco:**
```bash
df -h /
docker system prune -f
cd /root/<nombre>/<nombre> && rm -rf .next && npm run build
```

---

*Actualizar la tabla de puertos en el Paso 0 cada vez que agregues una app nueva.*
