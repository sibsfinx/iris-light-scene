# Continuation Prompt

Copy-paste this into any Claude session to continue this project:

---

I'm working on a Three.js 3D iris flower scene in `/Users/alexander/.var/.cd/iris-3d-claude/`.
It's a real-time render that replicates a Blender reference image (dark cinematic iris flower
with translucent blue petals, 4 RectAreaLights, bloom post-processing).

**Start here:** read `.agent/README.md` for project status, `.agent/TODO.md` for what's next,
`.agent/TECH.md` for technical details, and `.agent/REFERENCE.md` for the Blender scene spec.

**To run:** `COREPACK_ENABLE_STRICT=0 pnpm dev` (reads PORT env from `.claude/launch.json`).

**Current render:** dark background, deep blue iris petals with transmission/glass material,
glowing white rim highlights on petal edges, green stem, atmospheric fog. Looks close to
reference but needs: sharper petal geometry, tighter specular edges, depth-of-field pass.

Pick up from the highest-priority items in `.agent/TODO.md` and continue improving the scene.
Use the Claude Preview panel to screenshot after each change.
