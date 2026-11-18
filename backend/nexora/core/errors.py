from fastapi import HTTPException


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")


def forbidden(reason: str) -> HTTPException:
    return HTTPException(status_code=403, detail=reason)


def bad_request(reason: str) -> HTTPException:
    return HTTPException(status_code=400, detail=reason)
