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

import { PivotData, aggregators } from '../../src/react-pivottable/utilities';

/**
 * Regression test for issue #9: pivot table totals must use pre-computed
 * grand totals (from a separate query) rather than naively aggregating
 * per-row ratios.
 */
test('PivotData.applyGrandTotals overrides colTotals and allTotal with pre-computed values', () => {
  // Simulate the unpivoted data that PivotTableChart produces: each
  // record has a Metric field and a value field.
  const data = [
    { office: 'A', Metric: 'completion_rate', value: 0.85 },
    { office: 'B', Metric: 'completion_rate', value: 0.9 },
    { office: 'C', Metric: 'completion_rate', value: 0.95 },
    { office: 'D', Metric: 'completion_rate', value: 0.88 },
    { office: 'E', Metric: 'completion_rate', value: 0.89 },
  ];

  // Without grandTotals: totals aggregate via Sum → sums the ratios.
  const pivotNoFix = new PivotData({
    data,
    rows: ['office'],
    cols: ['Metric'],
    vals: ['value'],
    aggregatorName: 'Sum',
    aggregatorsFactory: () => aggregators,
  });
  const naiveTotalAgg = pivotNoFix.getAggregator([], ['completion_rate']);
  const naiveTotal = naiveTotalAgg.value();
  // 0.85 + 0.90 + 0.95 + 0.88 + 0.89 = 4.47
  expect(naiveTotal).toBeCloseTo(4.47, 1);

  // With grandTotals: the correct total from the DB-level query.
  const pivot = new PivotData({
    data,
    rows: ['office'],
    cols: ['Metric'],
    vals: ['value'],
    aggregatorName: 'Sum',
    aggregatorsFactory: () => aggregators,
    grandTotals: { completion_rate: 0.91 },
  });
  const fixedTotalAgg = pivot.getAggregator([], ['completion_rate']);
  expect(fixedTotalAgg.value()).toBeCloseTo(0.91, 2);

  // allTotal should also reflect the pre-computed value.
  const allTotalAgg = pivot.getAggregator([], []);
  expect(allTotalAgg.value()).toBeCloseTo(0.91, 2);
});
