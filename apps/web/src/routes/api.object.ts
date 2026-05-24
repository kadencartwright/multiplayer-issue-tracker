import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createFileRoute } from "@tanstack/react-router"

const endpoint = process.env.RUSTFS_ENDPOINT ?? "http://127.0.0.1:9000"
const bucket = process.env.RUSTFS_BUCKET ?? "issue-attachments"

const client = new S3Client({
	endpoint,
	region: process.env.RUSTFS_REGION ?? "us-east-1",
	forcePathStyle: true,
	credentials: {
		accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? "local-dev-access-key",
		secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? "local-dev-secret-key",
	},
})

export const Route = createFileRoute("/api/object")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const key = url.searchParams.get("key")

				if (!key) {
					return new Response("Missing object key", { status: 400 })
				}

				const object = await client.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: key,
					}),
				)

				return new Response(object.Body?.transformToWebStream(), {
					headers: {
						"content-type": object.ContentType ?? "application/octet-stream",
						"content-length": String(object.ContentLength ?? ""),
					},
				})
			},
		},
	},
})
