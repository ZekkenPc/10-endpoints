// ============================================================
// GUÍA RÁPIDA DE JEST (léelo una vez, te sirve para la explicación)
//
//  describe("nombre", () => { ... })  -> agrupa pruebas relacionadas
//  test("qué debe pasar", () => { ... }) -> UNA prueba
//  expect(valor).toBe(esperado)       -> la comprobación (aserción).
//                                        Si no se cumple, la prueba falla.
//  beforeAll / afterAll   -> se ejecutan 1 vez antes / después de todas
//  beforeEach             -> se ejecuta antes de CADA prueba
//
//  Supertest: request(app).get("/ruta") hace una petición HTTP
//  directo a Express, sin abrir un puerto real.
// ============================================================

const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");

// 1) Usamos una base de datos TEMPORAL para que las pruebas
//    no borren tu database.sqlite real.
//    IMPORTANTE: esto va ANTES del require("./index").
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-test-"));
process.env.DB_PATH = path.join(tmpDir, "test.sqlite");
process.env.BACKUP_PATH = path.join(tmpDir, "backup-test.sqlite");

// 2) Ahora sí importamos la app (ya lee las variables de arriba)
const { app, db } = require("./index");

// 3) Al terminar todo: cerramos la BD y borramos la carpeta temporal.
//    Sin esto Jest se queda "colgado" porque la BD sigue abierta.
afterAll((done) => {
  db.close(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    done();
  });
});

// 4) Antes de CADA prueba dejamos la BD vacía, así las pruebas
//    no dependen unas de otras.
beforeEach(async () => {
  await request(app).delete("/api/database/vaciar");
});

// ------------------------------------------------------------
describe("Salud y estadísticas", () => {
  test("GET /api/health responde OK", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data[0].status).toBe("OK");
    expect(res.body.data[0].status).toBe("OK");
    expect(res.body.data[0].message).toBe("todo bien mensaje 1");
  });

  test("GET /api/stats cuenta las tareas", async () => {
    await request(app).post("/api/database/seed"); // inserta 2 tareas

    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(200);
    expect(res.body.data[0].total).toBe(2);
  });
});

// ------------------------------------------------------------
describe("Base de datos (seed / vaciar)", () => {
  test("POST /api/database/seed inserta datos de prueba", async () => {
    const res = await request(app).post("/api/database/seed");
    expect(res.status).toBe(201);

    const lista = await request(app).get("/api/tareas");
    expect(lista.body.data).toHaveLength(2);
  });

  test("DELETE /api/database/vaciar deja la tabla vacía", async () => {
    await request(app).post("/api/database/seed");

    const res = await request(app).delete("/api/database/vaciar");
    expect(res.status).toBe(200);
    expect(res.body.data[0].message).toBe("Base de datos vaciada");

    const lista = await request(app).get("/api/tareas");
    expect(lista.body.data).toHaveLength(0);
  });
});

// ------------------------------------------------------------
describe("CRUD de tareas", () => {
  test("POST /api/tareas crea una tarea", async () => {
    const res = await request(app)
      .post("/api/tareas")
      .send({ titulo: "Realizar reporte de evidencias" });

    expect(res.status).toBe(201);
    expect(res.body.data[0].id).toBeDefined();
    expect(res.body.data[0].titulo).toBe("Realizar reporte de evidencias");
    expect(res.body.data[0].completada).toBe(0);
  });

  test("GET /api/tareas lista todas las tareas", async () => {
    await request(app).post("/api/database/seed");

    const res = await request(app).get("/api/tareas");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  test("GET /api/tareas/:id devuelve la tarea pedida", async () => {
    const creada = await request(app)
      .post("/api/tareas")
      .send({ titulo: "Tarea de consulta" });
    const id = creada.body.data[0].id;

    const res = await request(app).get(`/api/tareas/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].titulo).toBe("Tarea de consulta");
  });

  test("GET /api/tareas/:id devuelve 404 si no existe", async () => {
    const res = await request(app).get("/api/tareas/9999");

    expect(res.status).toBe(404);
    expect(res.body.data).toEqual([]);
  });

  test("PUT /api/tareas/:id actualiza la tarea", async () => {
    const creada = await request(app)
      .post("/api/tareas")
      .send({ titulo: "Original" });
    const id = creada.body.data[0].id;

    const res = await request(app)
      .put(`/api/tareas/${id}`)
      .send({ titulo: "Actualizada", completada: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data[0].completada).toBe(1);

    // Comprobamos que realmente se guardó en la BD
    const consulta = await request(app).get(`/api/tareas/${id}`);
    expect(consulta.body.data[0].titulo).toBe("Actualizada");
  });

  test("PUT /api/tareas/:id devuelve 404 si no existe", async () => {
    const res = await request(app)
      .put("/api/tareas/9999")
      .send({ titulo: "X", completada: 0 });

    expect(res.status).toBe(404);
  });

  test("DELETE /api/tareas/:id elimina la tarea", async () => {
    const creada = await request(app)
      .post("/api/tareas")
      .send({ titulo: "Para borrar" });
    const id = creada.body.data[0].id;

    const res = await request(app).delete(`/api/tareas/${id}`);
    expect(res.status).toBe(200);

    const consulta = await request(app).get(`/api/tareas/${id}`);
    expect(consulta.status).toBe(404);
  });

  test("DELETE /api/tareas/:id devuelve 404 si no existe", async () => {
    const res = await request(app).delete("/api/tareas/9999");

    expect(res.status).toBe(404);
  });
});

// ------------------------------------------------------------
describe("Backup", () => {
  test("GET /api/database/descargar-backup da 404 si aún no hay backup", async () => {
    // Nos aseguramos de que no exista el archivo
    fs.rmSync(process.env.BACKUP_PATH, { force: true });

    const res = await request(app).get("/api/database/descargar-backup");

    expect(res.status).toBe(404);
  });

  test("POST /api/database/backup genera el respaldo y luego se puede descargar", async () => {
    const backup = await request(app).post("/api/database/backup");
    expect(backup.status).toBe(200);
    expect(backup.body.data[0].message).toBe("Backup realizado exitosamente");

    const descarga = await request(app).get("/api/database/descargar-backup");
    expect(descarga.status).toBe(200);
    expect(descarga.headers["content-disposition"]).toContain(
      "backup_aws.sqlite",
    );
  });
});
