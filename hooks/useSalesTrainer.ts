// hooks/useSalesTrainer.ts
// React hook for managing sales trainer chat sessions

import { useState, useCallback } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface SessionState {
    mode: "roleplay" | "coaching" | "query" | null;
    activePersona: string | null;
    currentStage: number;
    objectionsSurfaced: string[];
    objectionsHandledWell: string[];
    objectionsHandledPoorly: string[];
    rapportScore: number;
    painDepthReached: "surface" | "moderate" | "deep";
    commitmentExtracted: boolean;
    priceRevealed: boolean;
    closeAttempted: boolean;
    outcome: "sold" | "lost" | "follow_up" | null;
}

interface UseSalesTrainerReturn {
    messages: Message[];
    sessionState: SessionState | null;
    isLoading: boolean;
    error: string | null;
    sendMessage: (content: string) => Promise<void>;
    resetSession: () => void;
    selectPersona: (persona: string) => Promise<void>;
    endRoleplay: () => Promise<void>;
    usage: { inputTokens: number; outputTokens: number } | null;
}

const DEFAULT_SESSION_STATE: SessionState = {
    mode: null,
    activePersona: null,
    currentStage: 1,
    objectionsSurfaced: [],
    objectionsHandledWell: [],
    objectionsHandledPoorly: [],
    rapportScore: 0,
    painDepthReached: "surface",
    commitmentExtracted: false,
    priceRevealed: false,
    closeAttempted: false,
    outcome: null,
};

export function useSalesTrainer(): UseSalesTrainerReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionState, setSessionState] = useState<SessionState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usage, setUsage] = useState<{
        inputTokens: number;
        outputTokens: number;
    } | null>(null);

    const sendMessage = useCallback(
        async (content: string) => {
            setIsLoading(true);
            setError(null);

            const userMessage: Message = { role: "user", content };
            const updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages);

            try {
                const response = await fetch("/api/sales-trainer", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: updatedMessages,
                        sessionState: sessionState || DEFAULT_SESSION_STATE,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();

                const assistantMessage: Message = {
                    role: "assistant",
                    content: data.message,
                };

                setMessages((prev) => [...prev, assistantMessage]);
                setSessionState(data.sessionState);
                setUsage(data.usage);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                setError(message);
            } finally {
                setIsLoading(false);
            }
        },
        [messages, sessionState]
    );

    const resetSession = useCallback(() => {
        setMessages([]);
        setSessionState(null);
        setError(null);
        setUsage(null);
    }, []);

    const selectPersona = useCallback(
        async (persona: string) => {
            await sendMessage(`Let's roleplay. I want to practice with ${persona}.`);
        },
        [sendMessage]
    );

    const endRoleplay = useCallback(async () => {
        await sendMessage(
            "End roleplay. Give me feedback on how I did."
        );
    }, [sendMessage]);

    return {
        messages,
        sessionState,
        isLoading,
        error,
        sendMessage,
        resetSession,
        selectPersona,
        endRoleplay,
        usage,
    };
}
