// app/api/sales-trainer/route.ts
// AI Sales Trainer API Route — Anthropic Claude + File-based KB Retrieval

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ============================================================
// TYPES
// ============================================================

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

interface RequestBody {
    messages: Message[];
    sessionState?: SessionState;
}

// ============================================================
// INITIALIZATION
// ============================================================

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Load system prompt from file
const SYSTEM_PROMPT = fs.readFileSync(
    path.join(process.cwd(), "knowledge-base", "system_prompt.md"),
    "utf-8"
);

// ============================================================
// KNOWLEDGE BASE RETRIEVAL (file-based)
// ============================================================

const KB_DIR = path.join(process.cwd(), "knowledge-base", "documents");

const knowledgeBase = {
    salesFramework: fs.readFileSync(
        path.join(KB_DIR, "sales_framework.md"),
        "utf-8"
    ),
    prospectPersonas: fs.readFileSync(
        path.join(KB_DIR, "prospect_personas.md"),
        "utf-8"
    ),
    objectionPlaybook: fs.readFileSync(
        path.join(KB_DIR, "objection_playbook.md"),
        "utf-8"
    ),
    prospectLines: fs.readFileSync(
        path.join(KB_DIR, "prospect_lines.md"),
        "utf-8"
    ),
};

// ============================================================
// CONTEXT BUILDER
// ============================================================

function buildContext(sessionState: SessionState): string {
    /**
     * Dynamically select which knowledge base sections to include
     * based on the current session state. This keeps the context
     * window efficient instead of dumping everything every turn.
     */

    let context = "";

    // Always include the relevant persona if in roleplay
    if (sessionState.mode === "roleplay" && sessionState.activePersona) {
        const personaName = sessionState.activePersona.toLowerCase();

        // Extract just the relevant persona section
        const personaRegex = new RegExp(
            `## Persona:.*?${personaName}.*?(?=\n## Persona:|$)`,
            "is"
        );
        const personaMatch =
            knowledgeBase.prospectPersonas.match(personaRegex);
        if (personaMatch) {
            context += "\n\n--- ACTIVE PERSONA ---\n" + personaMatch[0];
        }

        // Extract relevant prospect lines for this persona
        const linesRegex = new RegExp(
            `${personaName}:.*?(?=\n###|$)`,
            "gis"
        );
        const linesMatches =
            knowledgeBase.prospectLines.match(linesRegex);
        if (linesMatches) {
            context +=
                "\n\n--- PROSPECT DIALOGUE LINES ---\n" +
                linesMatches.join("\n");
        }
    }

    // Include stage-specific framework section
    if (sessionState.mode === "roleplay") {
        const stageMap: Record<number, string> = {
            1: "Stage 1",
            2: "Stage 2",
            3: "Stage 3",
            4: "Stage 4",
            5: "Stage 5",
        };
        const stageName = stageMap[sessionState.currentStage] || "Stage 1";
        const stageRegex = new RegExp(
            `## ${stageName}.*?(?=\n## Stage|$)`,
            "is"
        );
        const stageMatch =
            knowledgeBase.salesFramework.match(stageRegex);
        if (stageMatch) {
            context +=
                "\n\n--- CURRENT STAGE FRAMEWORK ---\n" + stageMatch[0];
        }
    }

    // Include objection playbook when in close stage or when objections start
    if (
        sessionState.currentStage >= 4 ||
        sessionState.objectionsSurfaced.length > 0
    ) {
        context +=
            "\n\n--- OBJECTION PLAYBOOK ---\n" +
            knowledgeBase.objectionPlaybook;
    }

    // In coaching mode, include everything for comprehensive review
    if (sessionState.mode === "coaching") {
        context +=
            "\n\n--- FULL FRAMEWORK ---\n" +
            knowledgeBase.salesFramework;
        context +=
            "\n\n--- FULL OBJECTION PLAYBOOK ---\n" +
            knowledgeBase.objectionPlaybook;
        if (sessionState.activePersona) {
            context +=
                "\n\n--- PERSONAS ---\n" +
                knowledgeBase.prospectPersonas;
        }
    }

    // In query mode, include all knowledge for comprehensive answers
    if (sessionState.mode === "query") {
        context +=
            "\n\n--- KNOWLEDGE BASE ---\n" +
            knowledgeBase.salesFramework +
            "\n\n" +
            knowledgeBase.prospectPersonas +
            "\n\n" +
            knowledgeBase.objectionPlaybook +
            "\n\n" +
            knowledgeBase.prospectLines;
    }

    return context;
}

// ============================================================
// DEFAULT SESSION STATE
// ============================================================

function getDefaultSessionState(): SessionState {
    return {
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
}

// ============================================================
// DETECT MODE AND PERSONA FROM USER MESSAGE
// ============================================================

function detectIntent(
    message: string,
    currentState: SessionState
): SessionState {
    const lower = message.toLowerCase();
    const newState = { ...currentState };

    // Detect mode
    if (
        lower.includes("roleplay") ||
        lower.includes("practice call") ||
        lower.includes("simulate") ||
        lower.includes("run me through")
    ) {
        newState.mode = "roleplay";
    } else if (
        lower.includes("review") ||
        lower.includes("feedback") ||
        lower.includes("how did i do") ||
        lower.includes("coach me") ||
        lower.includes("end roleplay")
    ) {
        newState.mode = "coaching";
    } else if (
        lower.includes("how do i") ||
        lower.includes("what is") ||
        lower.includes("tell me about") ||
        lower.includes("what stage") ||
        lower.includes("what's the")
    ) {
        newState.mode = "query";
    }

    // Detect persona selection
    const personaMap: Record<string, string> = {
        darren: "darren",
        jackie: "jackie",
        samuel: "samuel",
        matt: "matt",
        matthew: "matt",
        julie: "julie",
        laura: "laura",
    };

    for (const [key, value] of Object.entries(personaMap)) {
        if (lower.includes(key)) {
            newState.activePersona = value;
            if (!newState.mode) newState.mode = "roleplay";
            break;
        }
    }

    // Detect stage transitions during roleplay
    if (newState.mode === "roleplay") {
        if (
            lower.includes("is it okay if i") ||
            lower.includes("be direct") ||
            lower.includes("what stopped you") ||
            lower.includes("what held you back")
        ) {
            newState.currentStage = Math.max(newState.currentStage, 3);
        }
        if (
            lower.includes("take you through") ||
            lower.includes("show you how") ||
            lower.includes("let me walk you") ||
            lower.includes("the program") ||
            lower.includes("the mentorship")
        ) {
            newState.currentStage = Math.max(newState.currentStage, 4);
        }
        if (
            lower.includes("investment") ||
            lower.includes("price") ||
            lower.includes("payment") ||
            /\$?\d{1,2},?\d{3}/.test(lower) ||
            /£?\d{1,2},?\d{3}/.test(lower)
        ) {
            newState.currentStage = 5;
            newState.priceRevealed = true;
        }
    }

    return newState;
}

// ============================================================
// API ROUTE HANDLER
// ============================================================

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body: RequestBody = await request.json();
        const { messages } = body;

        // Initialize or update session state
        let sessionState = body.sessionState || getDefaultSessionState();

        // Detect intent from latest user message
        const latestMessage = messages[messages.length - 1];
        if (latestMessage.role === "user") {
            sessionState = detectIntent(
                latestMessage.content,
                sessionState
            );
        }

        // Build dynamic context based on session state
        const dynamicContext = buildContext(sessionState);

        // Construct the full system prompt
        const fullSystemPrompt = `${SYSTEM_PROMPT}

${dynamicContext}

--- CURRENT SESSION STATE ---
Mode: ${sessionState.mode || "not set"}
Active Persona: ${sessionState.activePersona || "none"}
Current Stage: ${sessionState.currentStage}
Objections Surfaced: ${sessionState.objectionsSurfaced.join(", ") || "none"}
Price Revealed: ${sessionState.priceRevealed}
Close Attempted: ${sessionState.closeAttempted}
Pain Depth: ${sessionState.painDepthReached}
Rapport Score: ${sessionState.rapportScore}/10`;

        // Call Anthropic Claude
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250514",
            max_tokens: 1024,
            system: fullSystemPrompt,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });

        // Extract text response
        const assistantMessage =
            response.content[0].type === "text"
                ? response.content[0].text
                : "";

        // Return response with updated session state
        return NextResponse.json({
            message: assistantMessage,
            sessionState: sessionState,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        });
    } catch (error: unknown) {
        console.error("Sales Trainer API Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            {
                error: "Failed to process request",
                details: message,
            },
            { status: 500 }
        );
    }
}
