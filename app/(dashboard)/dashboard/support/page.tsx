'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, ArrowLeft } from 'lucide-react';

export default function SupportPage() {
    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-6">
            <div>
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="mb-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold">Support</h1>
                <p className="text-muted-foreground mt-1">
                    We&apos;re here to help you get the most out of ClosePro.
                </p>
            </div>

            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        <CardTitle>Email Support</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-3">
                        Reach out to our team for any questions, feedback, or issues.
                    </p>
                    <a
                        href="mailto:support@closepro.ai"
                        className="text-primary font-medium hover:underline"
                    >
                        support@closepro.ai
                    </a>
                </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        <CardTitle>Common Questions</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        <li>
                            <strong className="text-foreground">How do I upload a call?</strong>
                            <br />
                            Go to Calls → New Call, then either upload an audio file or paste a transcript.
                        </li>
                        <li>
                            <strong className="text-foreground">Why did my analysis fail?</strong>
                            <br />
                            Check your API credits in Plans &amp; Billing. You can also set a GROQ_API_KEY in your .env for free-tier analysis.
                        </li>
                        <li>
                            <strong className="text-foreground">How do I start a roleplay?</strong>
                            <br />
                            Go to Roleplay → New Session. Select an offer and a prospect avatar to start practicing.
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
