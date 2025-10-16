import { getDB } from "./db.ts";
import { nowMs } from "./utils.ts";
import { World } from "./types.ts";

export function listWorlds(): World[] {
  seedDefaultWorldIfMissing();
  const db = getDB();
  const rows = db.prepare("SELECT id, name, synopsis, description, intro FROM worlds ORDER BY created_at ASC").all();
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    synopsis: row.synopsis as string,
    description: row.description as string,
    intro: row.intro as string,
  }));
}

export function getWorldById(id: string): World | null {
  if (!id) return null;
  seedDefaultWorldIfMissing();
  const db = getDB();
  const row = db.prepare("SELECT id, name, synopsis, description, intro FROM worlds WHERE id = ? LIMIT 1").get(id);
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    synopsis: row.synopsis as string,
    description: row.description as string,
    intro: row.intro as string,
  };
}

export function createWorld(name: string, synopsis: string, description: string, intro: string): World {
  const id = crypto.randomUUID();
  const ts = nowMs();
  const db = getDB();
  db.prepare(
    "INSERT INTO worlds (id, name, synopsis, description, intro, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name, synopsis, description, intro, ts, ts);
  const created = getWorldById(id);
  if (!created) throw new Error("Failed to create world");
  return created;
}

export function updateWorld(id: string, updates: Partial<Omit<World, "id">>): World | null {
  if (!id) return null;
  const existing = getWorldById(id);
  if (!existing) return null;
  const name = updates.name ?? existing.name;
  const synopsis = updates.synopsis ?? existing.synopsis;
  const description = updates.description ?? existing.description;
  const intro = updates.intro ?? existing.intro;
  const ts = nowMs();
  const db = getDB();
  db.prepare("UPDATE worlds SET name = ?, synopsis = ?, description = ?, intro = ?, updated_at = ? WHERE id = ?")
    .run(name, synopsis, description, intro, ts, id);
  return getWorldById(id);
}

export function deleteWorld(id: string): boolean {
  if (!id) return false;
  try {
    const result = getDB().prepare("DELETE FROM worlds WHERE id = ?").run(id);
    const changes = (result as { changes?: number } | undefined)?.changes ?? 0;
    return changes > 0;
  } catch (_) {
    return false;
  }
}

export function seedDefaultWorldIfMissing(): void {
  const db = getDB();
  const countRow = db.prepare("SELECT COUNT(1) as c FROM worlds").get() as { c: number } | undefined;
  const count = (countRow?.c ?? 0) as number;
  if (count > 0) return;
  const id = crypto.randomUUID();
  const ts = nowMs();
  const name = "The Realm Beyond";
  const synopsis = `An occult themed story, where the player has awakened their sleeping mind and has stepped into the Realm Beyond, parting the thin veil separating it from our world.`;
  const description = `
    ${synopsis}

    In the Realm Beyond, it is always night with a full moon. There is a cold fog omnipresent in the outside air,
    and there is no wind.

    The player starts at the station beyond the veil, waiting for their train. However, they have no ticket.

    They are not dead. They are actually sleeping, but their mind is awake: just not in the mortal world.
    The train station is far, far away in the outskirts of the realm. The player must find their way home.
    There is only one train at the station, and the world in the realm beyond does not follow our laws of physics.

    The player is not forced to board the train, but they are also incapable of not boarding it. Trying to
    walk away from the train and the station will cause the player to accidentally walk closer to the train instead.

    On the train, the player can meet some characters such as the conductor and a cat.

    The conductor is a man that looks exactly like the player. This is because the conductor is the player,
    even though they are not aware of it. The conductor will not speak, or move. it is frozen in place like a ghost,
    operating the train.

    The cat looks like a normal cat, but it can speak. It introduces himself as Oghert, but it just says it is a
    passenger and does not reveal futher details. He speaks is a very gentlemanly, sophisticated and somewhat old-fashioned
    manner. Oghert got lost and is trying to get back to the mortal world just like the player. He does
    not remember for how long he has been in the realm beyond, but it is implied it might be hundreds of years.

    Oghert will ask the player where their ticket is, and then help the player escape the inspector when the inspector shows up.

    Oghert does not remember almost nothing about the mortal world, and he will ask the player what they remember.

    Upon the player revealing a true memory of their worldly life that has strong emotional impact, the player will
    receive some Essence. This will have the effect of dissipating the fog somewhat in the area around the player and
    making them feel physically heavier.

    The player must also collect two other pieces of Essence for a total of three, using these methods:

    1. Reveal an emotionally powerful memory to restore their Soul Essence. This dissipates the fog around the player.
    2. Eat a piece of chocolate to restore their Mind Essence. Chocolate is hard to find in the Realm Beyond. This will let
    the player walk the Threads, which are hidden paths that effectively let the player teleport to previously visited places.
    3. Help another soul to restore their Heart Essence. This will let the player soothe any angry souls they encounter.

    The train departs when the player board and cannot be stopped. The player cannot get off the train either.
    The train will only stop when the player collects enough essence and is able to become the conductor, then
    the player can get off the train to end the game.

    Getting off the train to end the game will award the player with a Ticket, so that they can get back
    to the station beyond the veil if they want.

    Another soul can be helped by exploring the train. The various compartments will have different surreal
    environments and characters. At some point, if the player manages to bond with Oghert, the cat will say
    they feel like eating some yogurt. If the player can find the yogurt, the cat will remember they liked it
    in real life and unlock their Soul Essence. The player will also unlock their Heart Essence.
  `;
  const intro = `# Chapter 1: The Station Beyond the Veil

You awaken beneath gaslit eaves in a train station that exists beyond the veil.

*Shadows flicker, whispering promises from beyond the fading lights.*
*The air hums with the unspoken thoughts of the asleep, and your senses quiver with both dread and wonder.*

*Tonight, you are waiting for your train.*

Where does it take you?`;
  db.prepare(
    "INSERT INTO worlds (id, name, synopsis, description, intro, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name, synopsis, description, intro, ts, ts);
}
