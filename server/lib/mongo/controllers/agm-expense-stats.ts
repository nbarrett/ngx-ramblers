import debug from "debug";
import { PipelineStage } from "mongoose";
import { ExpenseAGMStats } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { dateTimeFromMillis } from "../../shared/dates";
import { envConfig } from "../../env-config/env-config";
import { expenseClaim } from "../models/expense-claim";

const debugLog = debug(envConfig.logNamespace("walk-admin:expenses"));
debugLog.enabled = false;

export async function calculateExpenseStats(fromDate: number, toDate: number): Promise<ExpenseAGMStats> {
  debugLog(`calculateExpenseStats: fromDate=${dateTimeFromMillis(fromDate).toISO()}, toDate=${dateTimeFromMillis(toDate).toISO()}, fromMillis=${fromDate}, toMillis=${toDate}`);
  const expensePipeline: PipelineStage[] = [
    expensesAddFields(true),
    paidEventsAddFields(),
    {
      $match: {
        "paidEvents.0": {$exists: true}
      }
    },
    {
      $addFields: {
        paidDate: {
          $ifNull: [
            {$first: "$paidEvents.date"},
            toDate
          ]
        }
      }
    },
    createdByFieldsAddStage(),
    {
      $match: {
        paidDate: {
          $gte: fromDate,
          $lte: toDate
        }
      }
    },
    {
      $project: {
        paidDate: "$paidDate",
        createdBy: "$createdBy",
        createdByName: "$createdByName",
        expenseItems: "$expenseItems",
        costField: "$cost"
      }
    },
    {
      $addFields: {
        itemDetails: {
          $map: {
            input: {$ifNull: ["$expenseItems", []]},
            as: "item",
            in: {
              description: {$ifNull: ["$$item.description", "Expense item"]},
              cost: {$ifNull: ["$$item.cost", 0]},
              paidDate: "$paidDate"
            }
          }
        },
        itemCount: {
          $size: {
            $ifNull: ["$expenseItems", []]
          }
        },
        totalCost: {
          $sum: {
            $map: {
              input: {$ifNull: ["$expenseItems", []]},
              as: "item",
              in: {$ifNull: ["$$item.cost", 0]}
            }
          }
        }
      }
    },
    {
      $addFields: {
        totalCost: {
          $cond: [
            {$gt: ["$totalCost", 0]},
            "$totalCost",
            {$ifNull: ["$costField", 0]}
          ]
        }
      }
    },
    {
      $lookup: {
        from: "members",
        let: {memberId: "$createdBy"},
        pipeline: [
          {
            $match: {
              $expr: {$eq: ["$memberId", "$$memberId"]}
            }
          },
          {
            $project: {
              displayName: 1
            }
          }
        ],
        as: "claimant"
      }
    },
    {
      $addFields: {
        claimantName: {$ifNull: [{$first: "$claimant.displayName"}, "$createdByName", "Unknown"]}
      }
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalClaims: {$sum: 1},
              totalItems: {$sum: "$itemCount"},
              totalCost: {$sum: "$totalCost"}
            }
          }
        ],
        payees: [
          {
            $group: {
              _id: {$ifNull: ["$createdBy", "unknown"]},
              name: {$first: {$ifNull: ["$claimantName", "Unknown"]}},
              totalCost: {$sum: "$totalCost"},
              totalItems: {$sum: "$itemCount"},
              claimCount: {$sum: 1},
              items: {$push: "$itemDetails"}
            }
          },
          {
            $sort: {totalCost: -1}
          },
          {
            $addFields: {
              items: {
                $reduce: {
                  input: {$ifNull: ["$items", []]},
                  initialValue: [],
                  in: {$concatArrays: ["$$value", {$ifNull: ["$$this", []]}]}
                }
              }
            }
          }
        ]
      }
    }
  ];

  const result = await expenseClaim.aggregate(expensePipeline);
  const totals = result[0]?.totals[0] || {totalClaims: 0, totalItems: 0, totalCost: 0};
  const payees = result[0]?.payees || [];
  debugLog(`calculateExpenseStats: found ${totals.totalClaims} claims, ${totals.totalItems} items, £${totals.totalCost}, ${payees.length} payees`);

  const unpaidExpensePipeline: PipelineStage[] = [
    expensesAddFields(true),
    paidEventsAddFields(),
    {
      $match: {
        "paidEvents.0": {$exists: false}
      }
    },
    createdByFieldsAddStage(),
    {
      $lookup: {
        from: "members",
        let: {memberId: "$createdBy"},
        pipeline: [
          {
            $match: {
              $expr: {$eq: ["$memberId", "$$memberId"]}
            }
          },
          {
            $project: {
              displayName: 1
            }
          }
        ],
        as: "claimant"
      }
    },
    {
      $addFields: {
        claimantName: {$ifNull: [{$first: "$claimant.displayName"}, "$createdByName", "Unknown"]}
      }
    },
    {$unwind: {path: "$expenseItems", preserveNullAndEmptyArrays: true}},
    {
      $project: {
        id: {$toString: "$_id"},
        claimantName: "$claimantName",
        description: {$ifNull: ["$expenseItems.description", "Expense item"]},
        cost: {$ifNull: ["$expenseItems.cost", 0]},
        expenseDate: {$ifNull: ["$expenseItems.expenseDate", "$expenseItems.date", 0]}
      }
    },
    {
      $match: {
        cost: {$gt: 0},
        expenseDate: {
          $gte: fromDate,
          $lte: toDate
        }
      }
    },
    {
      $sort: {expenseDate: -1}
    }
  ];

  const unpaidExpenses = await expenseClaim.aggregate(unpaidExpensePipeline);
  const totalUnpaidCost = unpaidExpenses.reduce((sum, item) => sum + (item.cost || 0), 0);
  debugLog(`calculateExpenseStats: found ${unpaidExpenses.length} unpaid expense items, total unpaid cost: £${totalUnpaidCost}`);

  return {
    totalClaims: totals.totalClaims || 0,
    totalItems: totals.totalItems || 0,
    totalCost: Math.round((totals.totalCost || 0) * 100) / 100,
    totalUnpaidCost: Math.round(totalUnpaidCost * 100) / 100,
    payees: payees.map((payer: any) => ({
      id: payer._id || "",
      name: payer.name || "Unknown",
      totalCost: Math.round((payer.totalCost || 0) * 100) / 100,
      totalItems: payer.totalItems || 0,
      claimCount: payer.claimCount || 0,
      items: (payer.items || []).map((item: any) => ({
        description: item.description || "Expense item",
        cost: Math.round((item.cost || 0) * 100) / 100,
        paidDate: item.paidDate || null
      }))
    })),
    unpaidExpenses: unpaidExpenses.map((item: any) => ({
      id: item.id || "",
      claimantName: item.claimantName || "Unknown",
      description: item.description || "Expense item",
      cost: Math.round((item.cost || 0) * 100) / 100,
      expenseDate: item.expenseDate || 0
    }))
  };
}

function expensesAddFields(includeItems: boolean): PipelineStage {
  const fields: Record<string, unknown> = {
    expenses: {$ifNull: ["$expenseEvents", []]}
  };

  if (includeItems) {
    fields.expenseItems = {$ifNull: ["$expenseItems", []]};
  }

  return {
    $addFields: fields
  };
}

function paidEventsAddFields(): PipelineStage {
  return {
    $addFields: {
      paidEvents: {
        $filter: {
          input: {$ifNull: ["$expenses", []]},
          as: "event",
          cond: {$eq: ["$$event.eventType.description", "Paid"]}
        }
      }
    }
  };
}

function createdByFieldsAddStage(): PipelineStage {
  return {
    $addFields: {
      createdBy: {
        $ifNull: [
          {$first: "$expenses.memberId"},
          "unknown"
        ]
      },
      createdByName: {
        $ifNull: [
          {$first: "$expenses.name"},
          {$first: "$expenses.displayName"},
          "Unknown"
        ]
      }
    }
  };
}

