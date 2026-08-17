# Publicación de imágenes en `neo-moka`

Este fork publica las imágenes de contenedor bajo `ghcr.io/neo-moka` en vez de
`ghcr.io/block`. El redireccionamiento es **configuración, no código**: se hace
con variables de repositorio, y por eso los workflows de upstream se pueden
seguir mergeando sin conflictos.

## Las tres imágenes

| Artefacto | Dockerfile | Imagen | Workflow |
|---|---|---|---|
| Relay | `Dockerfile` (targets `runtime` y `runtime-debug`) | `ghcr.io/neo-moka/quilotoa-aby` | `.github/workflows/docker.yml` |
| Push gateway | `Dockerfile.push-gateway` | `ghcr.io/neo-moka/quilotoa-aby-push-gateway` | `.github/workflows/docker.yml` |
| Sprig (runtime de agentes) | `Dockerfile.sprig` | `ghcr.io/neo-moka/quilotoa-aby-sprig` | `.github/workflows/sprig-image.yml` |

Son los únicos artefactos del repo con Dockerfile. Los otros binarios del
workspace (`buzz` CLI, `buzz-agent`, `buzz-admin`, `buzz-pair-relay`, …) se
distribuyen como binarios, no como imágenes.

## Variables de repositorio

Las cuatro se consultan con el patrón `vars.X != '' && vars.X || '<default de
upstream>'`, así que **si falta alguna el workflow no falla: publica al
namespace de Block y el push muere con 403.** Tienen que estar las cuatro.

| Variable | Valor |
|---|---|
| `GHCR_IMAGE` | `ghcr.io/neo-moka/quilotoa-aby` |
| `GHCR_PUSH_GATEWAY_IMAGE` | `ghcr.io/neo-moka/quilotoa-aby-push-gateway` |
| `GHCR_SPRIG_IMAGE` | `ghcr.io/neo-moka/quilotoa-aby-sprig` |
| `GHCR_CHART_REPO` | `oci://ghcr.io/neo-moka/quilotoa-aby/charts` |

```bash
gh variable set GHCR_IMAGE              -R neo-moka/quilotoa-aby -b ghcr.io/neo-moka/quilotoa-aby
gh variable set GHCR_PUSH_GATEWAY_IMAGE -R neo-moka/quilotoa-aby -b ghcr.io/neo-moka/quilotoa-aby-push-gateway
gh variable set GHCR_SPRIG_IMAGE        -R neo-moka/quilotoa-aby -b ghcr.io/neo-moka/quilotoa-aby-sprig
gh variable set GHCR_CHART_REPO         -R neo-moka/quilotoa-aby -b oci://ghcr.io/neo-moka/quilotoa-aby/charts
```

`GHCR_IMAGE` y `GHCR_SPRIG_IMAGE` ya venían de upstream.
`GHCR_PUSH_GATEWAY_IMAGE` y `GHCR_CHART_REPO` las agrega este fork, porque el
gateway y los charts eran los únicos hardcodeados a `ghcr.io/block`.

`GHCR_CHART_REPO` no es una imagen: es el namespace OCI al que `helm push`
sube los charts de `deploy/charts/`, y el comando le concatena el nombre del
chart — `oci://ghcr.io/neo-moka/quilotoa-aby/charts/buzz` y
`…/charts/buzz-push-gateway`. Esos nombres de chart vienen de los `Chart.yaml`
de upstream, así que siguen diciendo `buzz`.

## Cuándo se publica

- **push a `main`** → `:main` y `:sha-<7>` (más `:debug-*` para el relay).
- **tag `relay-v*`** → familia semver del relay y del gateway.
- **tag `sprig-v*`** → familia semver de sprig.
- **pull request** → build sin push, solo para mantener el caché caliente.

Los builds son multi-arch por matriz sobre runners nativos (`ubuntu-24.04` y
`ubuntu-24.04-arm`): cada arquitectura empuja por digest y un job final arma el
manifiesto. No hay emulación QEMU.

## Primera publicación

Dos pasos manuales que solo se hacen una vez:

1. **Habilitar Actions en el fork.** GitHub no registra los workflows de un
   repo forkeado hasta que alguien entra a la pestaña *Actions* y lo confirma.
   Mientras no se haga, `gh api /repos/neo-moka/quilotoa-aby/actions/workflows` devuelve
   `total_count: 0` y no corre nada.
2. **Hacer públicos los paquetes.** El primer push crea el paquete de GHCR como
   privado. Se cambia en *Package settings → Change visibility*, una vez por
   imagen. Los push siguientes conservan la visibilidad.

## Relación con el contrato de plataforma

Publicar estas imágenes desde GitHub Actions no contradice [ADR-0008][adr8]
(los productos despliegan por Cloud Build) por el mismo argumento que
[ADR-0014][adr14] usa para las imágenes builder: **construir una imagen es
build-time, no deploy-time.** Un despliegue baja una imagen que ya existe, así
que con GitHub caído no se publica nada nuevo pero nada deja de desplegarse.

Si algún día `quilotoa-aby` se da de alta como producto de la plataforma
—proyecto GCP, `cb-deploy@`, landing zone en `live/gcp/develop/quilotoa-aby/`—
la decisión de dónde viven estas imágenes se vuelve a abrir: el contrato manda
las imágenes de aplicación al Artifact Registry del proyecto del producto. Hoy
`quilotoa-aby` no está declarado en `stacks/github-org` ni tiene proyecto, así
que esa pregunta no está planteada.

[adr8]: https://github.com/neo-moka/devops/blob/main/docs/adr/0008-despliegue-por-cloud-build.md
[adr14]: https://github.com/neo-moka/devops/blob/main/docs/adr/0014-publicacion-de-imagenes-builder.md
