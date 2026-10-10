// Discord presence via Lanyard.
// You must be in the Lanyard Discord server (discord.gg/lanyard) for this to work.
const LANYARD_USER_ID = "817410231088578610";

async function updatePresence() {
  const line = document.getElementById("pline");
  try {
    const res = await fetch(
      "https://api.lanyard.rest/v1/users/" + LANYARD_USER_ID,
    );
    const json = await res.json();
    if (!json.success) throw new Error("Not tracked by Lanyard");
    const d = json.data,
      u = d.discord_user;

    document.getElementById("avatar").src = u.avatar
      ? "https://cdn.discordapp.com/avatars/" +
        u.id +
        "/" +
        u.avatar +
        ".png?size=128"
      : "https://cdn.discordapp.com/embed/avatars/" +
        ((BigInt(u.id) >> 22n) % 6n) +
        ".png";
    document.getElementById("pname").textContent = u.global_name || u.username;
    document.getElementById("dot").className = "dot " + d.discord_status;

    const acts = d.activities || [];
    const custom = acts.find((a) => a.type === 4);
    const game = acts.find((a) => a.type === 0);
    const coding = game && /code/i.test(game.name);
    let text;
    if (d.listening_to_spotify && d.spotify) {
      text =
        "Listening to " +
        d.spotify.song +
        " by " +
        d.spotify.artist.replace(/;/g, ",");
    } else if (game) {
      text =
        (coding ? "Coding in " : "Playing ") +
        game.name +
        (game.details ? " · " + game.details : "");
    } else if (custom && custom.state) {
      text = custom.state;
    } else {
      text = {
        online: "Online",
        idle: "Idle",
        dnd: "Do not disturb",
        offline: "Offline",
      }[d.discord_status];
    }
    line.textContent = text;
    line.title = text;
  } catch (e) {
    line.textContent = "Discord status unavailable";
  }
}

updatePresence();
setInterval(updatePresence, 15000);
