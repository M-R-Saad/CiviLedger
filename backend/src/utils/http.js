// Shared response helpers: keep internal error text out of API responses, and
// give every 500 a short reference the logs can be grepped by.

function serverError(res, context, err) {
  const ref = Math.random().toString(36).slice(2, 8);
  // eslint-disable-next-line no-console
  console.error(`[${context}] ref=${ref}`, err);
  return res.status(500).json({ error: "Something went wrong on our side. Try again shortly.", ref });
}

/**
 * Validate req.body against a zod schema. On failure, sends a 400 and returns
 * null; the caller must `return` when it gets null.
 *
 *   const data = parseBody(res, LoginSchema, req.body);
 *   if (!data) return;
 */
function parseBody(res, schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    res.status(400).json({
      error: "Some fields are missing or invalid.",
      details: result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    });
    return null;
  }
  return result.data;
}

module.exports = { serverError, parseBody };
