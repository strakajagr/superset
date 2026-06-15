/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  AdhocColumn,
  buildQueryContext,
  ensureIsArray,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormOrderBy,
} from '@superset-ui/core';
import { PivotTableQueryFormData } from '../types';

export default function buildQuery(formData: PivotTableQueryFormData) {
  const { groupbyColumns = [], groupbyRows = [], extra_form_data } = formData;
  const time_grain_sqla =
    extra_form_data?.time_grain_sqla || formData.time_grain_sqla;

  // TODO: add deduping of AdhocColumns
  const columns = Array.from(
    new Set([
      ...ensureIsArray<QueryFormColumn>(groupbyColumns),
      ...ensureIsArray<QueryFormColumn>(groupbyRows),
    ]),
  ).map(col => {
    if (
      isPhysicalColumn(col) &&
      time_grain_sqla &&
      (formData?.temporal_columns_lookup?.[col] ||
        formData.granularity_sqla === col)
    ) {
      return {
        timeGrain: time_grain_sqla,
        columnType: 'BASE_AXIS',
        sqlExpression: col,
        label: col,
        expressionType: 'SQL',
      } as AdhocColumn;
    }
    return col;
  });

  const { colTotals, rowTotals } = formData;

  return buildQueryContext(formData, baseQueryObject => {
    const { series_limit_metric, metrics, order_desc } = baseQueryObject;
    let orderBy: QueryFormOrderBy[] | undefined;
    if (series_limit_metric) {
      orderBy = [[series_limit_metric, !order_desc]];
    } else if (Array.isArray(metrics) && metrics[0]) {
      orderBy = [[metrics[0], !order_desc]];
    }

    const queries = [
      {
        ...baseQueryObject,
        orderby: orderBy,
        columns,
      },
    ];

    // When totals are enabled, add a second query that computes each metric
    // over the full dataset (no GROUP BY). This produces the correct grand
    // total for ratio metrics such as SUM(a)/SUM(b), which cannot be derived
    // by aggregating the per-row values that the main query returns.
    if (metrics?.length && (colTotals || rowTotals)) {
      queries.push({
        ...baseQueryObject,
        columns: [],
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
        order_desc: undefined,
        orderby: undefined,
      });
    }

    return queries;
  });
}
