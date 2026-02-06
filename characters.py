import requests
from pathlib import Path

OLLAMA_URL = "https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat"
MODEL_NAME = "llama3.1:8b"


def load_character_contract(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def query_character(
    character_contract: str,
    world_state: str,
    player_stats: str,
    lore: str,
    memory_logs: str,
    temperature: float = 0.2,   # 👈 default for reproducible characters
):
    user_prompt = f"""
World State:
{world_state}

Player Stats:
{player_stats}

Long Backstory Lore:
{lore}

Memory Logs:
{memory_logs}

What do you do now?
""".strip()

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": character_contract},
            {"role": "user", "content": user_prompt},
        ],
        "options": {
            "temperature": temperature
        },
        "stream": False,
    }

    response = requests.post(OLLAMA_URL, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()["message"]["content"]