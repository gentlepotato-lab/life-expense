"""
Superset 연동 API
- Guest Token 발급 (Embedded Dashboard용)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import os
import logging

router = APIRouter()

# 로거 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Superset 설정
SUPERSET_URL = os.getenv("SUPERSET_URL", "http://superset:8088")  # 내부 통신용
# SUPERSET_PUBLIC_URL = os.getenv("SUPERSET_PUBLIC_URL", "http://121.160.104.185:58088")  # 브라우저 접근용
SUPERSET_PUBLIC_URL = os.getenv("SUPERSET_PUBLIC_URL", "http://218.51.132.109:50082/:58088")  # 브라우저 접근용
SUPERSET_USERNAME = os.getenv("SUPERSET_USERNAME", "admin")
SUPERSET_PASSWORD = os.getenv("SUPERSET_PASSWORD", "admin")


class GuestTokenRequest(BaseModel):
    """Guest Token 요청 스키마"""
    dashboard_title: str  # Dashboard 제목 (예: "Embed-Test")


def get_superset_access_token() -> str:
    """Superset Admin Access Token 발급"""
    try:
        response = requests.post(
            f"{SUPERSET_URL}/api/v1/security/login",
            json={
                "username": SUPERSET_USERNAME,
                "password": SUPERSET_PASSWORD,
                "provider": "db",
                "refresh": True
            },
            timeout=10
        )
        response.raise_for_status()
        return response.json()["access_token"]
    except Exception as e:
        logger.error(f"Failed to get Superset access token: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Superset 인증 실패: {str(e)}"
        )


def get_dashboard_info_by_title(title: str, access_token: str) -> dict:
    """
    대시보드 제목으로 ID와 Embed UUID 조회
    Returns: {"dashboard_id": str, "embed_uuid": str}
    """
    try:
        logger.info(f"Looking up dashboard info for title: {title}")
        
        # 1. Dashboard ID 조회
        response = requests.get(
            f"{SUPERSET_URL}/api/v1/dashboard/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            params={
                "q": f'{{"filters":[{{"col":"dashboard_title","opr":"eq","value":"{title}"}}]}}'
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("count", 0) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"대시보드 '{title}'을 찾을 수 없습니다."
            )
        
        dashboard = data["result"][0]
        dashboard_id = str(dashboard["id"])
        logger.info(f"✓ Found dashboard ID {dashboard_id} for title '{title}'")
        
        # 2. Embed UUID 조회
        embed_response = requests.get(
            f"{SUPERSET_URL}/api/v1/dashboard/{dashboard_id}/embedded",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        embed_response.raise_for_status()
        embed_data = embed_response.json()
        
        embed_uuid = embed_data.get("result", {}).get("uuid", None)
        if not embed_uuid:
            logger.warning(f"No embed UUID found for dashboard {dashboard_id}")
        else:
            logger.info(f"✓ Found embed UUID: {embed_uuid}")
        
        return {
            "dashboard_id": dashboard_id,
            "embed_uuid": embed_uuid
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dashboard info by title: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"대시보드 조회 실패: {str(e)}"
        )


@router.post("/guest-token")
def get_guest_token(request: GuestTokenRequest):
    """
    Superset Guest Token 발급
    - Embedded Dashboard를 위한 Guest Token 생성
    - dashboard_title로 Dashboard ID를 조회한 후 Guest Token 발급
    - 필터는 URL 파라미터로 전달되므로 여기서는 처리하지 않음
    """
    try:
        logger.info(f"[GUEST-TOKEN] Request received for dashboard: '{request.dashboard_title}'")
        logger.info(f"[GUEST-TOKEN] SUPERSET_URL: {SUPERSET_URL}")
        logger.info(f"[GUEST-TOKEN] SUPERSET_PUBLIC_URL: {SUPERSET_PUBLIC_URL}")
        
        # 1. Admin Access Token 발급
        logger.info(f"[GUEST-TOKEN] Step 1: Getting admin access token...")
        access_token = get_superset_access_token()
        logger.info(f"[GUEST-TOKEN] ✓ Access token obtained")
        
        # 2. Dashboard 제목으로 Dashboard ID와 Embed UUID 조회
        logger.info(f"[GUEST-TOKEN] Step 2: Looking up dashboard info for '{request.dashboard_title}'...")
        dashboard_info = get_dashboard_info_by_title(request.dashboard_title, access_token)
        dashboard_id = dashboard_info["dashboard_id"]
        embed_uuid = dashboard_info["embed_uuid"]
        logger.info(f"[GUEST-TOKEN] ✓ Dashboard ID: {dashboard_id}, Embed UUID: {embed_uuid}")
        
        # 3. Guest Token 요청
        guest_token_payload = {
            "resources": [
                {
                    "type": "dashboard",
                    "id": dashboard_id
                }
            ],
            "rls": [],  # Row Level Security (필요시 추가)
            "user": {
                "username": "guest_user",
                "first_name": "Guest",
                "last_name": "User"
            }
        }
        
        logger.info(f"[GUEST-TOKEN] Step 3: Requesting guest token from Superset...")
        logger.info(f"[GUEST-TOKEN] Payload: {guest_token_payload}")

        response = requests.post(
            f"{SUPERSET_URL}/api/v1/security/guest_token/",
            json=guest_token_payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        logger.info(f"[GUEST-TOKEN] Superset response status: {response.status_code}")
        
        response.raise_for_status()
        
        guest_token = response.json()["token"]
        
        logger.info(f"[GUEST-TOKEN] ✓ Guest token issued successfully")
        logger.info(f"[GUEST-TOKEN] Token (first 50 chars): {guest_token[:50]}...")
        logger.info(f"[GUEST-TOKEN] Returning SUPERSET_PUBLIC_URL: {SUPERSET_PUBLIC_URL}")

        return {
            "token": guest_token,
            "dashboard_id": dashboard_id,
            "embed_uuid": embed_uuid,
            "superset_url": SUPERSET_PUBLIC_URL
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Superset API 호출 실패: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response: {e.response.text}")
        raise HTTPException(
            status_code=500,
            detail=f"Superset Guest Token 발급 실패: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Guest Token 발급 중 오류 발생: {str(e)}"
        )


@router.get("/dashboard-id")
def get_dashboard_id_by_title(title: str = "Embed-Test"):
    """
    대시보드 제목으로 ID 조회
    - 대시보드 제목을 받아서 ID를 반환
    """
    try:
        # Admin Access Token 발급
        access_token = get_superset_access_token()

        # 대시보드 목록 조회
        response = requests.get(
            f"{SUPERSET_URL}/api/v1/dashboard/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            params={
                "q": f'{{"filters":[{{"col":"dashboard_title","opr":"eq","value":"{title}"}}]}}'
            },
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("count", 0) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"대시보드 '{title}'을 찾을 수 없습니다."
            )
        
        dashboard = data["result"][0]
        
        return {
            "id": str(dashboard["id"]),
            "title": dashboard["dashboard_title"],
            "url": dashboard["url"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dashboard ID: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"대시보드 조회 실패: {str(e)}"
        )

