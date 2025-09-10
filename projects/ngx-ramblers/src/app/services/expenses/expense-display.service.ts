import { inject, Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { find } from "es-toolkit/compat";
import { isEmpty } from "es-toolkit/compat";
import { last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { Confirm, EditMode } from "../../models/ui-actions";
import {
  ExpenseClaim,
  ExpenseEvent,
  ExpenseEventType,
  ExpenseItem,
  ExpenseType
} from "../../notifications/expenses/expense.model";
import { ContentMetadataService } from "../content-metadata.service";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import { NumberUtilsService } from "../number-utils.service";
import { UrlService } from "../url.service";
import { ExpenseClaimService } from "./expense-claim.service";
import { CommitteeConfigService } from "../committee/commitee-config.service";
import { CommitteeReferenceData } from "../committee/committee-reference-data";
import { DEFAULT_COST_PER_MILE } from "../../models/committee.model";

@Injectable({
  providedIn: "root"
})

export class ExpenseDisplayService {
  private logger: Logger = inject(LoggerFactory).createLogger("RowSettingsActionButtonsComponent", NgxLoggerLevel.ERROR);
  private contentMetadata = inject(ContentMetadataService);
  private memberService = inject(MemberService);
  private committeeConfigService = inject(CommitteeConfigService);
  private memberLoginService = inject(MemberLoginService);
  private expenseClaimService = inject(ExpenseClaimService);
  private urlService = inject(UrlService);
  private numberUtils = inject(NumberUtilsService);
  private dateUtils = inject(DateUtilsService);

  public members: Member [] = [];

  public expenseTypes: ExpenseType[] = [
    {value: "travel-reccie", name: "Travel (walk reccie)", travel: true},
    {value: "travel-committee", name: "Travel (attend committee meeting)", travel: true},
    {value: "other", name: "Other"}];

  public eventTypes = {
    created: {description: "Created", editable: true} as ExpenseEventType,
    submitted: {description: "Submitted", actionable: true, notifyCreator: true, notifyApprover: true} as ExpenseEventType,
    "first-approval": {description: "First Approval", actionable: true, notifyApprover: true} as ExpenseEventType,
    "second-approval": {
      description: "Second Approval",
      actionable: true,
      notifyCreator: true,
      notifyApprover: true,
      notifyTreasurer: true
    } as ExpenseEventType,
    returned: {description: "Returned", atEndpoint: false, editable: true, notifyCreator: true, notifyApprover: true} as ExpenseEventType,
    paid: {description: "Paid", atEndpoint: true, notifyCreator: true, notifyApprover: true, notifyTreasurer: true} as ExpenseEventType
  };

  private receiptBaseUrl: string;
  public committeeReferenceData: CommitteeReferenceData;

  constructor() {
    this.receiptBaseUrl = this.contentMetadata.baseUrl("expenseClaims");
    this.populateData();
  }

  createEvent(expenseClaim: ExpenseClaim, eventType: ExpenseEventType, reason?: string) {
    if (!expenseClaim.expenseEvents) {
      expenseClaim.expenseEvents = [];
    }
    const event: ExpenseEvent = {
      date: this.dateUtils.nowAsValue(),
      memberId: this.memberLoginService.loggedInMember().memberId,
      eventType
    };
    if (reason) {
      event.reason = reason;
    }
    expenseClaim.expenseEvents.push(event);
  }

  prefixedExpenseItemDescription(expenseItem) {
    if (!expenseItem) {
      return "";
    }
    const prefix = expenseItem.expenseType && expenseItem.expenseType.travel ? expenseItem.expenseType.name + " - " : "";
    return prefix + expenseItem.description;
  }

  expenseItemDescription(expenseItem) {
    let description;
    if (!expenseItem) {
      return "";
    }
    if (expenseItem.travel && expenseItem.expenseType.travel) {
      description = [
        expenseItem.travel.from || "from",
        "to",
        expenseItem.travel.to || "to",
        expenseItem.travel.returnJourney ? "return trip" : "single trip",
        "(" + expenseItem.travel.miles,
        "miles",
        expenseItem.travel.returnJourney ? "x 2" : "",
        "x",
        this.numberUtils.asNumber(expenseItem.travel.costPerMile * 100, 0) + "p per mile)"
      ].join(" ");
    } else {
      description = expenseItem.description;
    }
    return description;
  }

  public defaultExpenseItem(): ExpenseItem {
    return cloneDeep({
      expenseType: this.expenseTypes[0],
      expenseDate: this.dateUtils.asValueNoTime(),
      cost: 0,
      travel: {
        costPerMile: this?.committeeReferenceData?.expensesConfig()?.costPerMile || DEFAULT_COST_PER_MILE,
        miles: 0,
        from: "",
        to: "",
        returnJourney: true
      }
    });
  }

  expenseItemCost(expenseItem) {
    let cost;
    if (!expenseItem) {
      return 0;
    }
    if (expenseItem.travel && expenseItem.expenseType.travel) {
      cost = (this.numberUtils.asNumber(expenseItem.travel.miles) *
        (expenseItem.travel.returnJourney ? 2 : 1) *
        this.numberUtils.asNumber(expenseItem.travel.costPerMile));
    } else {
      cost = expenseItem.cost;
    }
    return this.numberUtils.asNumber(cost, 2);
  }

  populateData() {
    this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS)
      .then((members) => {
        this.members = members;
      });
    this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
  }

  showExpenseEmailErrorAlert(notify: AlertInstance, message: string) {
    notify.error({title: "Expenses Error", message: "Your expense claim email processing failed. " + message});
  }

  showExpenseErrorAlert(notify: AlertInstance, message?: string) {
    const messageDefaulted = message || "Please try this again.";
    notify.error({title: "Expenses", message: "Your expense claim could not be saved. " + messageDefaulted});
  }

  deleteExpenseItem(confirm: Confirm, notify: AlertInstance, expenseClaim: ExpenseClaim, expenseItem: ExpenseItem, index: number) {
    this.saveExpenseItem(EditMode.DELETE, confirm, notify, expenseClaim, expenseItem, index);
  }

  saveExpenseItem(editMode: EditMode, confirm: Confirm, notify: AlertInstance, expenseClaim: ExpenseClaim, expenseItem: ExpenseItem, index: number) {
    const validateIndex = () => {
      if (!(index >= 0)) {
        this.showExpenseErrorAlert(notify, `Could not ${editMode} expense item due to invalid index: ${index}`);
      }
    };
    this.logger.debug("before", editMode, index, "item", "item count", expenseClaim.expenseItems.length);
    switch (editMode) {
      case EditMode.ADD_NEW:
        expenseClaim.expenseItems.push(expenseItem);
        break;
      case EditMode.DELETE:
        validateIndex();
        expenseClaim.expenseItems.splice(index, 1);
        break;
      case EditMode.EDIT:
        validateIndex();
        expenseClaim.expenseItems[index] = expenseItem;
        break;
      default:
        notify.error("no idea how to handle " + editMode);
    }
    this.logger.debug("after", editMode, index, "item", "item count", expenseClaim.expenseItems.length);
    return this.saveExpenseClaim(confirm, notify, expenseClaim);
  }

  saveExpenseClaim(confirm: Confirm, notify: AlertInstance, expenseClaim: ExpenseClaim) {
    this.recalculateClaimCost(expenseClaim);
    return this.expenseClaimService.createOrUpdate(expenseClaim)
      .then(() => confirm.clear())
      .then(() => notify.clearBusy());
  }

  recalculateClaimCost(expenseClaim: ExpenseClaim) {
    expenseClaim.cost = this.numberUtils.sumValues(expenseClaim.expenseItems, "cost");
  }

  receiptTitle(expenseItem: ExpenseItem) {
    return expenseItem && expenseItem.receipt ? (expenseItem.receipt.title || expenseItem.receipt.originalFileName) : "";
  }

  receiptUrl(expenseItem: ExpenseItem) {
    return expenseItem && expenseItem.receipt ? `${this.urlService.baseUrl()}/${this.receiptBaseUrl}/${expenseItem.receipt.awsFileName}` : "";
  }

  memberCanEditClaim(expenseClaim: ExpenseClaim) {
    return this.memberOwnsClaim(expenseClaim) || this.memberLoginService.allowFinanceAdmin();
  }

  memberOwnsClaim(expenseClaim: ExpenseClaim) {
    return (this.memberLoginService.loggedInMember().memberId === this.expenseClaimCreatedEvent(expenseClaim).memberId);
  }

  eventForEventType(expenseClaim: ExpenseClaim, expenseEventType: ExpenseEventType): ExpenseEvent {
    if (expenseClaim) {
      return find(expenseClaim.expenseEvents, event => event.eventType.description === expenseEventType.description) || {};
    } else {
      return {};
    }
  }

  expenseClaimHasEventType(expenseClaim: ExpenseClaim, eventType: ExpenseEventType): boolean {
    if (!expenseClaim) {
      return false;
    }
    const expenseEvent = this.eventForEventType(expenseClaim, eventType);
    this.logger.off("expenseClaimHasEventType:eventType:", eventType.description, expenseEvent);
    return !isEmpty(expenseEvent);
  }

  expenseClaimCreatedEvent(expenseClaim: ExpenseClaim): ExpenseEvent {
    return this.eventForEventType(expenseClaim, this.eventTypes.created);
  }

  expenseClaimLatestEvent(expenseClaim: ExpenseClaim): ExpenseEvent {
    this.logger.off("expenseClaimLatestEvent:", expenseClaim);
    return isEmpty(expenseClaim) ? {} : last(expenseClaim.expenseEvents) || {};
  }

  expenseClaimStatus(expenseClaim: ExpenseClaim): ExpenseEventType {
    this.logger.off("expenseClaimStatus:", expenseClaim);
    if (isEmpty(expenseClaim)) {
      return {};
    } else {
      this.logger.off("expenseClaimStatus:", expenseClaim);
      return this.expenseClaimLatestEvent(expenseClaim).eventType || {};
    }
  }

  editable(expenseClaim: ExpenseClaim) {
    return this.memberCanEditClaim(expenseClaim) && this.expenseClaimStatus(expenseClaim).editable;
  }

  editableAndOwned(expenseClaim) {
    return this.memberOwnsClaim(expenseClaim) && this.expenseClaimStatus(expenseClaim).editable;
  }

  allowFinanceAdmin() {
    return this.memberLoginService.allowFinanceAdmin();
  }

  allowEditExpenseItem(expenseClaim: ExpenseClaim) {
    return isEmpty(expenseClaim) ? false : expenseClaim.expenseItems.length > 0 && this.allowAddExpenseItem(expenseClaim) && expenseClaim && expenseClaim.id;
  }

  allowAddExpenseItem(expenseClaim: ExpenseClaim) {
    return this.editable(expenseClaim);
  }

  allowDeleteExpenseItem(expenseClaim: ExpenseClaim) {
    return this.allowEditExpenseItem(expenseClaim);
  }

  allowDeleteExpenseClaim(expenseClaim: ExpenseClaim) {
    return !this.allowDeleteExpenseItem(expenseClaim) && this.allowAddExpenseItem(expenseClaim);
  }

  allowAdminFunctions() {
    return this.memberLoginService.allowTreasuryAdmin() || this.memberLoginService.allowFinanceAdmin();
  }

  showExpenseSuccessAlert(notify: AlertInstance, message: string, busy?: boolean) {
    notify.success({title: "Expenses", message}, busy);
  }

  showExpenseProgressAlert(notify: AlertInstance, message: string, busy?: boolean) {
    notify.progress({title: "Expenses", message}, busy);
  }
}
