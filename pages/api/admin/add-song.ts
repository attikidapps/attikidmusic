export default function handler(req, res) {
      if (req.headers.authorization !== process.env.ADMIN_PASSWORD) {
          return res.status(401).json({ error: "Unauthorized" });
            }

              // later: add logic to update songs.json or DB
                res.status(200).json({ success: true });
                }