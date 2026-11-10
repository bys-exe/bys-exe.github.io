---
title: Homelab
description: home server i made for storing images
pubDate: 2026-11-10
---

This is an self-hosted homelab running on my old laptop which got repurposed as an home server. Built to replace google photos especially because of its 15gb limit and for privacy.

im making this blog post for archiving what i did so dont expect any guide from me for this kek, the home labbing rabbit hole is really fun

## Why did i start doing this

I always saw youtube videos about self hosting and got interested in it. I have tons of personal photos (~150gb of photos) in my external hard drive and i wanted get access to them anywhere in my mobile/laptop like google photos so i turned laptop into an server :p

## info about my laptop

i got this laptop from my dad's office like 10 years ago (very old), it is an sony vaio (You probably never heard of this because it's very old and discontinued now xD) and It has 512gb HDD storage with 4gb ram :3

![Neofetch of laptop](./images/NEOFETCH.png)

## Services i used

| Service       | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| **Immich**    | Self-hosted photo & video backup (Google Photos open source alternative) |
| **Homepage**  | Displays all services in my server very aestheticly                      |
| **Tailscale** | Secure remote access via VPN mesh network (Can use immich anywhere)      |

---

## Architecture

```
                        ┌─────────────────────────────────┐
                        │         Old Laptop Server       │
                        │         (Ubuntu Server)         │
                        │                                 |
                        |                                 │
 Local Network     ─────|  :2283  Immich                  |
                        │  :3000  Homepage Dashboard      │
                        │                                 │
                        │  ┌─────────────────────────┐    │
                        │  │      Docker images      │    │
                        │  │  immich-server          │    │
                        │  │  homepage               │    │
                        │  └─────────────────────────┘    │
                        │                                 │
                        └───────────────-─────────────────┘
                                        │
                        ┌───────────────▼─────────────────┐
                        │       Tailscale Network         │
                        │   Access from phone / laptop    │
                        │     anywhere in the world       │
                        └─────────────────────────────────┘
```

---

## More about the services that i used (google definitions with my screenshots lol read if interested)

### Immich

A full-featured, self-hosted photo and video backup solution. Replaces Google Photos completely.

- Automatic mobile backup
- Face recognition and person tagging (runs on-device via the ML container)
- Smart search powered by CLIP embeddings
- Timeline view, albums, shared libraries
- Runs as 4 coordinated containers: server, machine learning, postgres, redis

**Access:** `http://<server-ip>:2283` on local network, or via Tailscale IP from anywhere

![Immich Screenshot](./images/immich-1.png)

### Homepage Dashboard

A clean, customizable dashboard that shows all running services in one place.

- Live status indicators for each service
- Quick-access links to all self-hosted apps
- Configured via YAML files

**Access:** `http://<server-ip>:3000`

![Homepage Screenshot](./images/server-dashboard.png)

### Tailscale

Tailscale creates a secure WireGuard-based mesh VPN between devices. This means the home server is reachable from anywhere — phone, laptop, college — without exposing any ports to the public internet.

- No open ports on the home router
- End-to-end encrypted traffic
- Works behind CGNAT (most Indian ISPs (i hate you airtel))

---

## References

- [Immich Documentation](https://docs.immich.app)
- [Tailscale Documentation](https://tailscale.com/kb)
- [Docker Documentation](https://docs.docker.com)
