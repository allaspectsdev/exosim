import { config } from "./config.js";
import { buildServer } from "./server.js";
import { clusterState } from "./state/cluster.js";
import { startMdnsAdvertiser } from "./mdns/advertiser.js";

async function main() {
  const app = await buildServer();

  const nodes = clusterState.getNodes();
  const master = nodes.find((n) => n.isMaster);

  console.log(`
╔══════════════════════════════════════════════╗
║               ExoSim v0.1.0                  ║
║     Exo Cluster Simulator → Claude Opus      ║
╠══════════════════════════════════════════════╣
║  Port:        ${String(config.PORT).padEnd(30)}║
║  Model:       ${config.ANTHROPIC_MODEL.padEnd(30)}║
║  Nodes:       ${String(nodes.length).padEnd(30)}║
║  Master:      ${(master?.name ?? "none").padEnd(30)}║
╚══════════════════════════════════════════════╝
`);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  await startMdnsAdvertiser();
}

main().catch((err) => {
  console.error("Failed to start ExoSim:", err);
  process.exit(1);
});
