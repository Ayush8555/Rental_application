# Server setup checklist (section 20)

Do this once per server (staging and production), Ubuntu LTS, India region.

1. Users and SSH
   - Create a sudo user, add team SSH keys, then in `/etc/ssh/sshd_config`:
     `PermitRootLogin no`, `PasswordAuthentication no`. Restart sshd.
   - `apt install fail2ban unattended-upgrades` and enable both.
2. Firewall (ufw)
   - `ufw default deny incoming`
   - `ufw allow from <team IP> to any port 22`
   - `ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable`
   - Docker publishes only Caddy's 80/443; Postgres and Redis have no ports.
3. Docker
   - Install Docker Engine + compose plugin from Docker's apt repo.
4. Secrets
   - `infra/.env`, `infra/api.env`, `infra/secrets/pg_owner_password`, `infra/secrets/pg_app_password`, all `chmod 600`,
     owned by the deploy user. Values come from the password manager.
   - `api.env` uses `backend/.env.example` as the template. `DATABASE_URL` uses
     `rentnook_app` with the password from `pg_app_password` (see postgres/roles.sql).
5. Backups
   - `apt install age rclone`, configure the `offsite` remote (separate account),
     add `infra/scripts/backup.sh` to cron at 02:30.
   - First restore drill before launch.
6. Monitoring
   - Uptime check on `https://api.<domain>/health` every minute.
   - CPU, RAM and disk alerts; certificate expiry alert.
7. Staging only
   - Copy `caddy/extra.example/*` to `caddy/extra/`, set the team IPs and the
     basic-auth hash (`docker run --rm caddy caddy hash-password`). Keep staging data fake.
   - On production create an empty `caddy/extra/` directory.
