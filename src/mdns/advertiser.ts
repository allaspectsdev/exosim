import { config } from "../config.js";

let mdnsInstance: { destroy: () => void } | null = null;

export async function startMdnsAdvertiser(): Promise<void> {
  if (!config.ENABLE_MDNS) return;

  try {
    // Dynamic import — multicast-dns is optional
    // @ts-expect-error multicast-dns is an optional dependency
    const mdnsModule = await import("multicast-dns");
    const mdns = mdnsModule.default();

    mdns.on("query", (query: { questions: Array<{ name: string; type: string }> }) => {
      const hasExoQuery = query.questions.some(
        (q) => q.name === "_exo._tcp.local" || q.name.includes("exo")
      );

      if (hasExoQuery) {
        mdns.respond({
          answers: [
            {
              name: "_exo._tcp.local",
              type: "SRV",
              data: {
                port: config.PORT,
                target: "exosim.local",
                weight: 0,
                priority: 0,
              },
            },
            {
              name: "_exo._tcp.local",
              type: "TXT",
              data: ["exosim=true", "version=0.1.0"],
            },
          ],
        });
      }
    });

    mdnsInstance = mdns;
    console.log(`mDNS advertiser started: _exo._tcp on port ${config.PORT}`);
  } catch (err) {
    console.warn(
      "mDNS advertiser failed to start. Install 'multicast-dns' package for mDNS support:",
      (err as Error).message
    );
  }
}

export function stopMdnsAdvertiser(): void {
  if (mdnsInstance) {
    mdnsInstance.destroy();
    mdnsInstance = null;
  }
}
