import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
                // Authenticate the user
                const session = await auth.api.getSession({
                    headers: await headers(),
                });

                if (!session?.user) {
                    throw new Error('Not authenticated');
                }

                return {
                    addRandomSuffix: true,
                    allowedContentTypes: [
                        'audio/mpeg',        // .mp3
                        'audio/mp4',         // .m4a
                        'audio/x-m4a',       // .m4a alt
                        'audio/wav',         // .wav
                        'audio/webm',        // .webm
                        'audio/ogg',         // .ogg
                    ],
                    maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB max
                    tokenPayload: JSON.stringify({
                        userId: session.user.id,
                    }),
                };
            },
            onUploadCompleted: async ({ blob }) => {
                console.log('Blob upload completed:', blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 },
        );
    }
}
