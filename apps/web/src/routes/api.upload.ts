import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3"
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

async function ensureBucket() {
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }))
	} catch {
		await client.send(new CreateBucketCommand({ Bucket: bucket }))
	}
}

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const form = await request.formData()
				const file = form.get("file")
				const issueId = String(form.get("issueId") ?? "unassigned")

				if (!(file instanceof File)) {
					return new Response("Missing image file", { status: 400 })
				}

				if (!file.type.startsWith("image/")) {
					return new Response("Only image uploads are supported", {
						status: 400,
					})
				}

				await ensureBucket()
				const safeName = file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "-")
				const key = `${issueId}/${crypto.randomUUID()}-${safeName}`
				const bytes = Buffer.from(await file.arrayBuffer())

				await client.send(
					new PutObjectCommand({
						Bucket: bucket,
						Key: key,
						Body: bytes,
						ContentType: file.type,
					}),
				)

				return Response.json({
					key,
					fileName: file.name,
					contentType: file.type,
					size: file.size,
					url: `/api/object?key=${encodeURIComponent(key)}`,
				})
			},
		},
	},
})
