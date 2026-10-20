// Switched off 2026-10-20 (Oché): the public quote widget is retired; the new build has no public pricing route.
const gone = () => new Response("Not found", { status: 404 });

export const GET = gone;
export const POST = gone;
export const OPTIONS = gone;
