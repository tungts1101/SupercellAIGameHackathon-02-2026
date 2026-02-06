# main.py
# Narrative test harness using DeepSeek-R1 (reasoning model)
# Fixes:
# 1) Strip <think>...</think> from outputs
# 2) Allow storyteller to narrate visible consequences after an action

import json
import re
from pathlib import Path
import requests

OLLAMA_BASE_URL = "https://excitingly-unsolitary-jayson.ngrok-free.dev"
MODEL = "deepseek-r1:8b"

PROMPT_PATH = Path("prompts/storyteller.md")
CAMPAIGN_JSON_PATH = Path("campaigns/the_weight_of_gold.json")


# ---------- Utilities ----------

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def strip_think(text: str) -> str:
    """Remove DeepSeek-R1 <think>...</think> blocks."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def ollama_chat(
    base_url: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.2,
    timeout_s: int = 90,
) -> str:
    url = base_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "options": {
            "temperature": temperature,
        },
        "stream": False,
    }

    r = requests.post(url, json=payload, timeout=timeout_s)
    r.raise_for_status()
    return r.json()["message"]["content"]


# ---------- Prompt construction ----------

def build_storyteller_context(campaign: dict) -> str:
    arc = campaign.get("campaign", {}).get("arc", {})
    overview = campaign.get("campaign", {}).get("story_overview", {})
    setting = campaign.get("setting", {})
    final_scene = campaign.get("final_scene", {})
    boss = campaign.get("boss", {}).get("identity", {})

    return "\n".join(
        [
            f"Arc Title: {arc.get('title', '')}",
            f"Arc Scope: {arc.get('scope', '')}",
            f"Premise: {overview.get('premise', '')}",
            f"Arc Start: {overview.get('arc_start', '')}",
            f"Final Scene Location: {setting.get('final_scene_location', {}).get('name', '')}",
            f"Final Scene Description: {setting.get('final_scene_location', {}).get('description', '')}",
            f"Boss: {boss.get('name', '')} — {boss.get('title', '')} ({boss.get('type', '')})",
            f"Entry Moment: {final_scene.get('entry_moment', '')}",
            f"Stakes: {', '.join(final_scene.get('stakes', []))}",
            f"Narrative Pressure: {json.dumps(final_scene.get('narrative_pressure', {}), ensure_ascii=False)}",
        ]
    ).strip()


# ---------- Main flow ----------

def main():
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Missing {PROMPT_PATH}")
    if not CAMPAIGN_JSON_PATH.exists():
        raise FileNotFoundError(f"Missing {CAMPAIGN_JSON_PATH}")

    storyteller_md = read_text(PROMPT_PATH)
    campaign = read_json(CAMPAIGN_JSON_PATH)

    ctx = build_storyteller_context(campaign)

    # --- Turn 0: Opening narration ---
    opening_user_prompt = f"""
CAMPAIGN CONTEXT (authoritative):
{ctx}

SCENE REQUEST:
Write the opening narration for the arc start: the party arrives at the Black Keep and approaches the throne hall.
Keep it atmospheric and high-stakes. Do not include choices or actions.
""".strip()

    print("\n=== STORYTELLER: OPENING ===\n")
    opening_raw = ollama_chat(
        OLLAMA_BASE_URL,
        MODEL,
        system_prompt=storyteller_md,
        user_prompt=opening_user_prompt,
        temperature=0.2,
    )
    opening = strip_think(opening_raw)
    print(opening)

    # --- Turn 1: Simple character action ---
    action_event = {
        "actor": "Ronan",
        "action": "opens an old chest half-buried in the hoard near a collapsed pillar",
        "location_detail": "edge of the throne hall, where gold has pooled like a landslide",
    }

    followup_user_prompt = f"""
CAMPAIGN CONTEXT (authoritative):
{ctx}

PREVIOUS NARRATION:
{opening}

NEW EVENT (already occurred):
{json.dumps(action_event, ensure_ascii=False)}

TASK:
Describe the immediate narrative aftermath of this event as it becomes visible in the scene.
Do not introduce choices or new actions.
""".strip()

    print("\n=== STORYTELLER: AFTER ACTION (Ronan opens chest) ===\n")
    after_action_raw = ollama_chat(
        OLLAMA_BASE_URL,
        MODEL,
        system_prompt=storyteller_md,
        user_prompt=followup_user_prompt,
        temperature=0.2,
    )
    after_action = strip_think(after_action_raw)
    print(after_action)


if __name__ == "__main__":
    main()