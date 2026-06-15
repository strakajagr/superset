# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from unittest.mock import MagicMock

import pandas as pd

from superset import viz
from superset.utils import json
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing.utils import FLAT_COLUMN_SEPARATOR


def _make_datasource() -> MagicMock:
    datasource = MagicMock()
    datasource.type = "table"
    datasource.query_language = "sql"
    return datasource


def test_get_data_single_group_by() -> None:
    """Single Group By produces a flat Index; serialization succeeds."""
    datasource = _make_datasource()
    form_data = {"metrics": ["sum__A"], "groupby": ["region"]}
    test_viz = viz.TimeTableViz(datasource, form_data)

    t1 = pd.Timestamp("2000")
    t2 = pd.Timestamp("2002")
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [t1, t1, t2, t2],
            "sum__A": [10, 20, 30, 40],
            "region": ["East", "West", "East", "West"],
        }
    )

    data = test_viz.get_data(df)

    assert data is not None
    assert set(data["columns"]) == {"East", "West"}
    assert data["is_group_by"] is True
    # Must be JSON-serializable
    json.dumps(data, default=str)


def test_get_data_multiple_group_by() -> None:
    """Two Group By columns produce a MultiIndex; columns must be flattened."""
    sep = FLAT_COLUMN_SEPARATOR
    datasource = _make_datasource()
    form_data = {"metrics": ["sum__A"], "groupby": ["region", "product"]}
    test_viz = viz.TimeTableViz(datasource, form_data)

    t1 = pd.Timestamp("2000")
    t2 = pd.Timestamp("2002")
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [t1, t1, t1, t1, t2, t2, t2, t2],
            "sum__A": [10, 20, 30, 40, 50, 60, 70, 80],
            "region": ["East", "East", "West", "West"] * 2,
            "product": ["A", "B", "A", "B"] * 2,
        }
    )

    data = test_viz.get_data(df)

    assert data is not None

    east_a = f"East{sep}A"
    east_b = f"East{sep}B"
    west_a = f"West{sep}A"
    west_b = f"West{sep}B"
    assert set(data["columns"]) == {east_a, east_b, west_a, west_b}
    assert data["is_group_by"] is True

    time_format = "%Y-%m-%d %H:%M:%S"
    expected = {
        t1.strftime(time_format): {east_a: 10, east_b: 20, west_a: 30, west_b: 40},
        t2.strftime(time_format): {east_a: 50, east_b: 60, west_a: 70, west_b: 80},
    }
    assert data["records"] == expected

    # The whole payload must be JSON-serializable (the original bug:
    # "keys must be str, int, float, bool or None, not tuple")
    json.dumps(data, default=str)


def test_get_data_multiple_group_by_with_separator_in_value() -> None:
    """Group By values containing the separator character are escaped."""
    datasource = _make_datasource()
    form_data = {"metrics": ["sum__A"], "groupby": ["region", "product"]}
    test_viz = viz.TimeTableViz(datasource, form_data)

    t1 = pd.Timestamp("2000")
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [t1, t1],
            "sum__A": [10, 20],
            "region": ["East, Coast", "West"],
            "product": ["A", "B"],
        }
    )

    data = test_viz.get_data(df)

    assert data is not None
    # "East, Coast" contains the separator comma; it must be escaped
    for col in data["columns"]:
        assert isinstance(col, str)
    assert len(data["columns"]) == 2
    json.dumps(data, default=str)


def test_get_data_no_group_by() -> None:
    """Without Group By, multiple metrics are used as columns."""
    datasource = _make_datasource()
    form_data = {"metrics": ["sum__A", "count"]}
    test_viz = viz.TimeTableViz(datasource, form_data)

    t1 = pd.Timestamp("2000")
    t2 = pd.Timestamp("2002")
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [t1, t2],
            "sum__A": [15, 20],
            "count": [6, 7],
        }
    )

    data = test_viz.get_data(df)

    assert data is not None
    assert set(data["columns"]) == {"count", "sum__A"}
    assert data["is_group_by"] is False
    json.dumps(data, default=str)


def test_get_data_empty_dataframe() -> None:
    """Empty DataFrame returns None."""
    datasource = _make_datasource()
    form_data = {"metrics": ["sum__A"], "groupby": ["region", "product"]}
    test_viz = viz.TimeTableViz(datasource, form_data)

    df = pd.DataFrame()
    assert test_viz.get_data(df) is None
