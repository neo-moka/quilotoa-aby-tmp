#!/usr/bin/env python3
"""Tests de scripts/buzz-adopt-server-agents. Sin red, sin SSH, sin el store real.

    python3 scripts/test_buzz_adopt_server_agents.py
    scripts/buzz-adopt-server-agents --selftest

Cubre las tres cosas que pueden romper en silencio y lejos del síntoma:

  1. El parser del agent.env, con el escape de systemd que ya nos mordió una vez
     (un desescape ingenuo corrompe el auth tag). El caso fuerte es el
     round-trip contra el ESCRITOR real (env_file_lines de buzz-backend-neomoka):
     no comparamos contra una expectativa escrita a mano sino contra el código
     que de verdad produce los archivos del server.
  2. La derivación del pubkey, contra los vectores de prueba de BIP-340.
  3. La construcción del record desde una plantilla y el upsert, incluido que
     los pubkeys vacíos no cuenten como coincidencia.
"""

import importlib.util
import json
import os
import sys
import unittest
from importlib.machinery import SourceFileLoader

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, filename):
    """Importa un script sin extensión .py como módulo."""
    path = os.path.join(HERE, filename)
    spec = importlib.util.spec_from_loader(name, SourceFileLoader(name, path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


adopt = _load("buzz_adopt_server_agents", "buzz-adopt-server-agents")
backend = _load("buzz_backend_neomoka", "buzz-backend-neomoka")


# Auth tag con la forma real: JSON, así que todas sus comillas llegan escapadas.
AUTH_TAG = '["auth", "' + "ab" * 32 + '", "", "' + "cd" * 64 + '"]'
SECRET_HEX = "b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef"
SECRET_PUBKEY = "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659"


def sample_env_text(**overrides):
    """agent.env de ejemplo, serializado por el ESCRITOR real del provider."""
    env = {
        "BUZZ_PRIVATE_KEY": SECRET_HEX,
        "BUZZ_AUTH_TAG": AUTH_TAG,
        "BUZZ_RELAY_URL": "wss://relay.aby.quilotoa.neomoka.com",
        "BUZZ_ACP_AGENT_COMMAND": "hermes-acp",
        "BUZZ_ACP_AGENT_ARGS": "",
        "BUZZ_ACP_DISPLAY_NAME": "Jhoana",
        "BUZZ_ACP_RESPOND_TO": "anyone",
        "NEOMOKA_MCP": "dropi",
    }
    env.update(overrides)
    return backend.env_file_lines(env)


TEMPLATE = {
    "pubkey": "ff" * 32,
    "name": "Molde",
    "persona_id": "c6c53da6-38e9-4ab1-a5cf-9834b1ed51fd",
    "team_id": "c4af90f1-20af-4301-a5be-49a628978e38",
    "auth_tag": "<auth tag de otro agente>",
    "relay_url": "",
    "avatar_url": "https://example.invalid/molde.png",
    "acp_command": "buzz-acp",
    "agent_command": "goose-acp",
    "agent_command_override": None,
    "agent_args": ["x"],
    "mcp_command": "",
    "turn_timeout_seconds": 320,
    "idle_timeout_seconds": 99,
    "max_turn_duration_seconds": 99,
    "parallelism": 1,
    "system_prompt": "prompt del molde",
    "model": "openai-codex:gpt-5.6-sol",
    "provider": None,
    "persona_source_version": "93a744ca",
    "start_on_app_launch": True,
    "auto_restart_on_config_change": True,
    "runtime_pid": 4321,
    "backend": {"type": "local"},
    "backend_agent_id": None,
    "provider_policy_pending": False,
    "provider_binary_path": "/Users/otro/.local/bin/buzz-backend-neomoka",
    "created_at": "2026-01-01T00:00:00+00:00",
    "updated_at": "2026-01-01T00:00:00+00:00",
    "last_started_at": "2026-01-01T00:00:00+00:00",
    "last_stopped_at": None,
    "last_exit_code": 0,
    "last_error": "algo viejo",
    "last_error_code": 7,
    "respond_to": "owner-only",
    "respond_to_allowlist": [],
    "runtime": "hermes",
    "is_builtin": False,
    "is_active": True,
}

NOW = "2026-09-02T21:00:00+00:00"
HOST = "root@134.122.118.128"
IDENTITY = "~/workspace_skerna/.ssh/id_ed25519_moka_dev_ci"


class TestEnvParsing(unittest.TestCase):
    def test_round_trip_contra_el_escritor_real(self):
        """Escribir con env_file_lines y leer con parse_env_file es identidad.

        Es el test que importa: ata el lector al escritor que genera de verdad
        los agent.env del server, en vez de a una expectativa escrita a mano.
        """
        original = {
            "BUZZ_AUTH_TAG": AUTH_TAG,
            "BUZZ_PRIVATE_KEY": SECRET_HEX,
            "CON_BARRA": r"C:\ruta\rara",
            "BARRA_Y_COMILLA": r'a\\"b',
            "BARRA_FINAL": "termina en barra\\",
            "VACIO": "",
            "CON_IGUAL": "clave=valor=otro",
            "CON_ESPACIOS": "  con espacios  ",
        }
        self.assertEqual(
            adopt.parse_env_file(backend.env_file_lines(original)), original
        )

    def test_auth_tag_sobrevive_el_desescape(self):
        env = adopt.parse_env_file(sample_env_text())
        self.assertEqual(env["BUZZ_AUTH_TAG"], AUTH_TAG)
        self.assertEqual(json.loads(env["BUZZ_AUTH_TAG"])[0], "auth")

    def test_borrar_comillas_corrompe_el_auth_tag(self):
        """El bug ya sufrido: un `sed` que borra comillas invalida el JSON.

        Es el modo de fallo real que hay que evitar, y es silencioso: el record
        se escribe, la app arranca y el agente queda sin atestación válida.
        """
        line = backend.env_file_lines({"BUZZ_AUTH_TAG": AUTH_TAG}).strip()
        sed_style = line.split("=", 1)[1].replace('"', "")
        self.assertEqual(adopt.parse_env_file(line)["BUZZ_AUTH_TAG"], AUTH_TAG)
        with self.assertRaises(json.JSONDecodeError):
            json.loads(sed_style)

    def test_round_trip_de_casos_borde_con_barras_y_comillas(self):
        r"""Barras y comillas en toda combinación hasta 4 caracteres.

        El desescape carácter a carácter es el inverso exacto del escritor; este
        test lo fija como propiedad en vez de confiar en un puñado de ejemplos.
        """
        import itertools

        for largo in range(1, 5):
            for combo in itertools.product(["a", "\\", '"'], repeat=largo):
                valor = "".join(combo)
                self.assertEqual(
                    adopt.parse_env_file(backend.env_file_lines({"K": valor}))["K"],
                    valor,
                )

    def test_ignora_comentarios_y_lineas_vacias(self):
        text = '# comentario\n\nBUZZ_RELAY_URL="wss://x"\n\n'
        self.assertEqual(adopt.parse_env_file(text), {"BUZZ_RELAY_URL": "wss://x"})

    def test_linea_malformada_es_error_sin_filtrar_contenido(self):
        with self.assertRaises(adopt.AdoptError) as ctx:
            adopt.parse_env_file('BUZZ_PRIVATE_KEY=nsec1secretosinComillas\n')
        self.assertNotIn("nsec1", str(ctx.exception))
        self.assertIn("línea 1", str(ctx.exception))


class TestDerivacion(unittest.TestCase):
    def test_vectores_bip340(self):
        # El primero es 1·G, o sea la coordenada X del generador: verificable
        # contra la constante de la curva sin depender de la implementación.
        vectores = [
            (
                "00" * 31 + "01",
                "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
            ),
            (
                "00" * 31 + "03",
                "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
            ),
            (SECRET_HEX, SECRET_PUBKEY),
        ]
        for secret, expected in vectores:
            with self.subTest(secret=secret[:8]):
                self.assertEqual(adopt.derive_pubkey_hex(secret), expected)

    def test_nsec_bech32(self):
        # Vector de NIP-19: la nsec y su hex son la misma clave. El checksum
        # bech32 se valida al decodificar, así que ambos lados se atan solos.
        nsec = "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5"
        hexkey = "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa"
        self.assertEqual(adopt.derive_pubkey_hex(nsec), adopt.derive_pubkey_hex(hexkey))

    def test_checksum_invalido_falla(self):
        malo = "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe4"
        with self.assertRaises(adopt.AdoptError):
            adopt.derive_pubkey_hex(malo)

    def test_formato_desconocido_no_filtra_la_clave(self):
        with self.assertRaises(adopt.AdoptError) as ctx:
            adopt.derive_pubkey_hex("clave-secreta-en-formato-raro")
        self.assertNotIn("clave-secreta", str(ctx.exception))

    def test_cero_y_orden_de_la_curva_rechazados(self):
        for invalido in ["00" * 32, format(adopt._CURVE_N, "064x")]:
            with self.assertRaises(adopt.AdoptError):
                adopt.derive_pubkey_hex(invalido)


class TestBuildRecord(unittest.TestCase):
    def build(self, **overrides):
        env = adopt.parse_env_file(sample_env_text(**overrides))
        return adopt.build_record(
            "jhoana", env, SECRET_PUBKEY, TEMPLATE, HOST, IDENTITY, NOW
        )

    def test_campos_del_agente(self):
        record = self.build()
        self.assertEqual(record["pubkey"], SECRET_PUBKEY)
        self.assertEqual(record["name"], "Jhoana")
        self.assertEqual(record["private_key_nsec"], SECRET_HEX)
        self.assertEqual(record["auth_tag"], AUTH_TAG)
        self.assertEqual(record["relay_url"], "wss://relay.aby.quilotoa.neomoka.com")
        self.assertEqual(record["agent_command"], "hermes-acp")
        self.assertEqual(record["agent_args"], [])
        self.assertEqual(record["respond_to"], "anyone")
        self.assertEqual(record["backend_agent_id"], "jhoana")
        self.assertEqual(
            record["backend"],
            {
                "type": "provider",
                "id": "neomoka",
                "config": {"host": HOST, "identity_file": IDENTITY},
            },
        )

    def test_no_hereda_la_identidad_de_la_plantilla(self):
        """Persona, equipo, avatar y modelo del molde no deben viajar.

        Heredarlos linkearía el agente adoptado a la persona de otro agente, y
        el Desktop lo mostraría como una instancia de esa persona.
        """
        record = self.build()
        for campo in (
            "persona_id", "team_id", "avatar_url", "model", "runtime",
            "persona_source_version",
        ):
            self.assertFalse(record.get(campo), f"{campo} se heredó del molde")
        self.assertNotIn("team_id", record)
        self.assertNotIn("runtime", record)
        self.assertEqual(record["system_prompt"], "")
        self.assertEqual(record["idle_timeout_seconds"], None)
        self.assertEqual(record["max_turn_duration_seconds"], None)

    def test_limpia_el_estado_de_runtime_del_molde(self):
        record = self.build()
        self.assertIsNone(record["runtime_pid"])
        self.assertIsNone(record["last_started_at"])
        self.assertIsNone(record["last_error"])
        self.assertIsNone(record["last_error_code"])
        self.assertIsNone(record["last_exit_code"])
        self.assertIsNone(record["provider_binary_path"])
        self.assertFalse(record["start_on_app_launch"])
        self.assertEqual(record["created_at"], NOW)
        self.assertEqual(record["updated_at"], NOW)

    def test_conserva_los_campos_obligatorios_del_serde(self):
        """Sin estos campos la app no puede deserializar el store."""
        record = self.build()
        for campo in (
            "pubkey", "name", "relay_url", "acp_command", "agent_command",
            "agent_args", "mcp_command", "turn_timeout_seconds", "system_prompt",
            "created_at", "updated_at", "last_started_at", "last_stopped_at",
            "last_exit_code", "last_error",
        ):
            self.assertIn(campo, record)

    def test_sin_plantilla_usa_el_esquema_minimo(self):
        env = adopt.parse_env_file(sample_env_text())
        record = adopt.build_record(
            "jhoana", env, SECRET_PUBKEY, None, HOST, IDENTITY, NOW
        )
        for campo in ("acp_command", "mcp_command", "turn_timeout_seconds", "parallelism"):
            self.assertIn(campo, record)
        self.assertEqual(record["acp_command"], "buzz-acp")

    def test_nombre_cae_al_slug_sin_display_name(self):
        env = adopt.parse_env_file(sample_env_text())
        del env["BUZZ_ACP_DISPLAY_NAME"]
        record = adopt.build_record(
            "valentina", env, SECRET_PUBKEY, TEMPLATE, HOST, IDENTITY, NOW
        )
        self.assertEqual(record["name"], "valentina")

    def test_args_y_timeouts(self):
        record = self.build(
            BUZZ_ACP_AGENT_ARGS="acp,--verbose",
            BUZZ_ACP_IDLE_TIMEOUT="120",
            BUZZ_ACP_MAX_TURN_DURATION="600",
        )
        self.assertEqual(record["agent_args"], ["acp", "--verbose"])
        self.assertEqual(record["idle_timeout_seconds"], 120)
        self.assertEqual(record["max_turn_duration_seconds"], 600)

    def test_recupera_modelo_y_pool(self):
        """BUZZ_ACP_MODEL y BUZZ_ACP_AGENTS son el reverso de model/parallelism.

        El spawn los emite desde el record (runtime.rs:732 y :681), así que el
        agent.env del server es una copia fiel y vale la pena revertirlos: sin
        esto un redeploy encogería el pool a 1 y perdería el modelo.
        """
        record = self.build(BUZZ_ACP_MODEL="openai-codex:gpt-5.6-sol", BUZZ_ACP_AGENTS="4")
        self.assertEqual(record["model"], "openai-codex:gpt-5.6-sol")
        self.assertEqual(record["parallelism"], 4)

    def test_sin_modelo_ni_pool_quedan_neutros(self):
        record = self.build()
        self.assertIsNone(record["model"])
        self.assertEqual(record["parallelism"], 1)

    def test_respond_to_invalido_cae_a_owner_only(self):
        record = self.build(BUZZ_ACP_RESPOND_TO="cualquiera")
        self.assertEqual(record["respond_to"], "owner-only")

    def test_allowlist_normalizada(self):
        record = self.build(
            BUZZ_ACP_RESPOND_TO="allowlist",
            BUZZ_ACP_RESPOND_TO_ALLOWLIST=("AB" * 32) + ",no-es-hex," + ("ab" * 32),
        )
        self.assertEqual(record["respond_to_allowlist"], ["ab" * 32])

    def test_record_es_serializable(self):
        json.dumps(self.build())


class TestUpsert(unittest.TestCase):
    def remote(self):
        return {"jhoana": sample_env_text(), "malcom": sample_env_text(
            BUZZ_PRIVATE_KEY="00" * 31 + "03", BUZZ_ACP_DISPLAY_NAME="Malcom"
        )}

    def plan(self, store):
        return adopt.build_plan(
            self.remote(),
            adopt.index_by_pubkey(store),
            set(),
            HOST,
            IDENTITY,
            adopt.pick_template(store),
            NOW,
        )

    def test_store_vacio_adopta_todo(self):
        rows = self.plan([])
        self.assertEqual([r["action"] for r in rows], ["adoptar", "adoptar"])

    def test_pubkey_existente_no_se_duplica(self):
        store = [dict(TEMPLATE, pubkey=SECRET_PUBKEY, name="Jhoana")]
        rows = {r["slug"]: r for r in self.plan(store)}
        self.assertEqual(rows["jhoana"]["action"], "ya existe (sin cambios)")
        self.assertIsNone(rows["jhoana"]["record"])
        self.assertEqual(rows["malcom"]["action"], "adoptar")

    def test_records_sin_clave_no_cuentan_como_coincidencia(self):
        """Los records de definición llevan pubkey "" y no deben capturar nada."""
        store = [dict(TEMPLATE, pubkey="", name="Jhoana")]
        self.assertEqual(adopt.index_by_pubkey(store), {})
        self.assertEqual([r["action"] for r in self.plan(store)], ["adoptar", "adoptar"])

    def test_pick_template_prefiere_un_record_con_pubkey(self):
        store = [dict(TEMPLATE, pubkey="", name="SinClave"), dict(TEMPLATE, name="ConClave")]
        self.assertEqual(adopt.pick_template(store)["name"], "ConClave")

    def test_filtro_por_agente(self):
        rows = adopt.build_plan(
            self.remote(), {}, {"malcom"}, HOST, IDENTITY, TEMPLATE, NOW
        )
        self.assertEqual([r["slug"] for r in rows], ["malcom"])

    def test_agente_con_clave_rota_no_frena_a_los_demas(self):
        remote = dict(self.remote(), roto=sample_env_text(BUZZ_PRIVATE_KEY="no-es-clave"))
        rows = {r["slug"]: r for r in adopt.build_plan(
            remote, {}, set(), HOST, IDENTITY, TEMPLATE, NOW
        )}
        self.assertTrue(rows["roto"]["action"].startswith("error"))
        self.assertIsNone(rows["roto"]["record"])
        self.assertEqual(rows["jhoana"]["action"], "adoptar")


class TestSalidaSinSecretos(unittest.TestCase):
    def test_el_plan_no_imprime_claves_ni_auth_tags(self):
        rows = adopt.build_plan(
            {"jhoana": sample_env_text()}, {}, set(), HOST, IDENTITY, TEMPLATE, NOW
        )
        salida = adopt.render_plan(rows)
        self.assertNotIn(SECRET_HEX, salida)
        self.assertNotIn("auth", salida)
        self.assertNotIn("cd" * 64, salida)
        self.assertIn("jhoana", salida)
        self.assertIn(SECRET_PUBKEY[:16], salida)

    def test_las_variables_no_mapeadas_se_reportan_por_nombre(self):
        env = adopt.parse_env_file(sample_env_text())
        extras = adopt.unmapped_env_keys(env)
        self.assertEqual(extras, ["NEOMOKA_MCP"])
        for secreta in adopt.SECRET_ENV_KEYS:
            self.assertNotIn(secreta, extras)


class TestSalidaRemota(unittest.TestCase):
    def salida(self, *slugs, cerrada=True):
        partes = []
        for slug in slugs:
            partes.append(f"{adopt.BLOCK_BEGIN}{slug}===")
            partes.append(sample_env_text().rstrip("\n"))
        if cerrada:
            partes.append(adopt.BLOCK_END)
        return "\n".join(partes) + "\n"

    def test_trocea_por_slug(self):
        bloques = adopt.split_remote_output(self.salida("jhoana", "malcom"))
        self.assertEqual(sorted(bloques), ["jhoana", "malcom"])
        self.assertIn("BUZZ_PRIVATE_KEY", bloques["jhoana"])

    def test_salida_truncada_falla(self):
        with self.assertRaises(adopt.AdoptError):
            adopt.split_remote_output(self.salida("jhoana", cerrada=False))

    def test_server_sin_agentes(self):
        self.assertEqual(adopt.split_remote_output(adopt.BLOCK_END + "\n"), {})

    def test_fetch_usa_el_runner_inyectado(self):
        llamadas = []

        def runner(host, identity, script):
            llamadas.append((host, identity, script))
            return self.salida("jhoana")

        bloques = adopt.fetch_remote_envs(HOST, IDENTITY, ssh_runner=runner)
        self.assertEqual(list(bloques), ["jhoana"])
        self.assertEqual(llamadas[0][0], HOST)
        self.assertNotIn("~", llamadas[0][1])  # la identidad se expande
        self.assertIn("/agent.env", llamadas[0][2])


class TestDeteccionDeInstancia(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        import shutil

        shutil.rmtree(self.tmp, ignore_errors=True)

    def crear(self, nombre, mtime):
        store = os.path.join(self.tmp, nombre, "agents", "managed-agents.json")
        os.makedirs(os.path.dirname(store), exist_ok=True)
        with open(store, "w", encoding="utf-8") as handle:
            json.dump([], handle)
        os.utime(store, (mtime, mtime))
        return os.path.join(self.tmp, nombre)

    def test_elige_la_instancia_mas_reciente(self):
        self.crear("xyz.block.buzz.app", 1_000_000)
        nueva = self.crear("xyz.block.buzz.app.dev.feature-aby", 2_000_000)
        self.assertEqual(adopt.detect_instance(support_dir=self.tmp), nueva)

    def test_ignora_directorios_sin_store(self):
        os.makedirs(os.path.join(self.tmp, "xyz.block.buzz.app.vacia"))
        unica = self.crear("xyz.block.buzz.app", 1_000_000)
        self.assertEqual(adopt.detect_instance(support_dir=self.tmp), unica)

    def test_sin_instancias_es_error(self):
        with self.assertRaises(adopt.AdoptError):
            adopt.detect_instance(support_dir=self.tmp)

    def test_instancia_explicita_se_valida(self):
        with self.assertRaises(adopt.AdoptError):
            adopt.detect_instance(explicit=self.tmp)


class TestEscritura(unittest.TestCase):
    def test_backup_y_escritura_atomica(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            store = os.path.join(tmp, "agents", "managed-agents.json")
            os.makedirs(os.path.dirname(store))
            with open(store, "w", encoding="utf-8") as handle:
                json.dump([{"pubkey": "aa", "name": "Viejo"}], handle, indent=2)

            nuevos = [{"pubkey": "aa", "name": "Viejo"}, {"pubkey": "bb", "name": "Nuevo"}]
            backup = adopt.write_store(tmp, nuevos)

            with open(store, encoding="utf-8") as handle:
                self.assertEqual(len(json.load(handle)), 2)
            with open(backup, encoding="utf-8") as handle:
                self.assertEqual(len(json.load(handle)), 1)
            self.assertEqual(os.stat(store).st_mode & 0o777, 0o600)
            self.assertFalse(os.path.exists(store + ".adopt-tmp"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
