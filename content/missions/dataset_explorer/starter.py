"""Mission: Dataset Explorer. Plain Python only - no pandas."""


def column_stats(rows: list[dict], column: str) -> dict:
    """Return {'count', 'missing', 'mean', 'median', 'std'} for column, ignoring None values.

    count = number of non-missing values; std is the population standard deviation.
    If all values are missing, mean, median and std are None.
    """
    raise NotImplementedError


def group_mean(rows: list[dict], by: str, column: str) -> dict:
    """Mean of column for each distinct value of `by`, ignoring missing values.

    Groups whose values are all missing map to None.
    """
    raise NotImplementedError
