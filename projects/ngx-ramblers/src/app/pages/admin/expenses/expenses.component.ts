import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { faCaretDown, faCaretUp, faCashRegister } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import extend from "lodash-es/extend";
import filter from "lodash-es/filter";
import first from "lodash-es/first";
import isArray from "lodash-es/isArray";
import isEmpty from "lodash-es/isEmpty";
import isEqual from "lodash-es/isEqual";
import last from "lodash-es/last";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { chain } from "../../../functions/chain";
import { AlertTarget } from "../../../models/alert-target.model";
import { ApiAction, ApiResponse } from "../../../models/api-response.model";
import { Member } from "../../../models/member.model";
import { Confirm, ConfirmType } from "../../../models/ui-actions";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import {
  ExpenseClaim,
  ExpenseEvent,
  ExpenseFilter,
  ExpenseItem,
  ExpenseNotificationRequest
} from "../../../notifications/expenses/expense.model";
import { ExpenseClaimService } from "../../../services/expenses/expense-claim.service";
import { ExpenseDisplayService } from "../../../services/expenses/expense-display.service";
import { ExpenseNotificationService } from "../../../services/expenses/expense-notification.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { ExpenseDetailModalComponent } from "./modals/expense-detail-modal.component";
import { ExpensePaidModalComponent } from "./modals/expense-paid-modal.component";
import { ExpenseReturnModalComponent } from "./modals/expense-return-modal.component";
import { ExpenseSubmitModalComponent } from "./modals/expense-submit-modal.component";
import { NotificationConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

const SELECTED_EXPENSE = "Expense from last email link";

@Component({
  selector: "app-expenses",
  templateUrl: "./expenses.component.html",
  styleUrls: ["../admin/admin.component.sass", "./expenses.component.sass"],
  standalone: false
})
export class ExpensesComponent implements OnInit, OnDestroy {
  faCashRegister = faCashRegister;
  faCaretUp = faCaretUp;
  faCaretDown = faCaretDown;
  private logger: Logger;
  private expenseId: string;
  private dataError: boolean;
  public members: Member[];
  public expenseClaims: ExpenseClaim[];
  private unfilteredExpenseClaims: ExpenseClaim[];
  public selected: {
    expenseClaim: ExpenseClaim,
    expenseItem: ExpenseItem,
    filter: ExpenseFilter,
    showOnlyMine: boolean,
  };
  public notify: AlertInstance;
  private notifyConfirm: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notifyConfirmTarget: AlertTarget = {};
  public confirm = new Confirm();
  public filters: ExpenseFilter[];
  private subscriptions: Subscription[] = [];
  private notificationConfig: NotificationConfig;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  expandable: boolean;
  showOrHide = "hide";

  constructor(private authService: AuthService,
              private expenseClaimService: ExpenseClaimService,
              private memberLoginService: MemberLoginService,
              private memberService: MemberService,
              private modalService: BsModalService,
              private notifierService: NotifierService,
              private mailMessagingService: MailMessagingService,
              private route: ActivatedRoute,
              private urlService: UrlService,
              public display: ExpenseDisplayService,
              public notifications: ExpenseNotificationService,
              loggerFactory: LoggerFactory) {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notifyConfirm = this.notifierService.createAlertInstance(this.notifyConfirmTarget);
    this.logger = loggerFactory.createLogger(ExpensesComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.notificationConfig = this.notificationConfig = this.mailMessagingService.queryNotificationConfig(this.notify, mailMessagingConfig, "expenseNotificationConfigId");;
    });
    this.notify.setBusy();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.urlService.navigateTo(["admin"]);
    }));
    this.subscriptions.push(this.expenseClaimService.notifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.notifyError(apiResponse);
      } else {
        this.applyExpensesToView(apiResponse);
      }
    }));
    this.dataError = false;
    this.members = [];
    this.expenseClaims = [];
    this.unfilteredExpenseClaims = [];
    this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.expenseId = paramMap.get("expense-id");
      this.filters = [{
        disabled: !this.expenseId,
        description: SELECTED_EXPENSE,
        filter: expenseClaim => {
          if (this.expenseId) {
            return expenseClaim && expenseClaim.id === this.expenseId;
          } else {
            return false;
          }
        }
      }, {
        description: "Unpaid expenses",
        filter: expenseClaim => !this.display.expenseClaimStatus(expenseClaim).atEndpoint
      }, {
        description: "Paid expenses",
        filter: expenseClaim => this.display.expenseClaimStatus(expenseClaim).atEndpoint
      }, {
        description: "Expenses awaiting action from me",
        filter: expenseClaim => this.memberLoginService.allowFinanceAdmin() ? this.display.editable(expenseClaim) : this.display.editableAndOwned(expenseClaim)
      }, {
        description: "All expenses",
        filter: () => true
      }];

      this.selected = {
        expenseClaim: undefined,
        expenseItem: undefined,
        showOnlyMine: !this.display.allowAdminFunctions(),
        filter: this.filters[!!this.expenseId ? 0 : 1]
      };
      this.logger.debug("ngOnInit - expense-id:", this.expenseId, "this.filters:", this.filters, "this.selected:", this.selected);
      this.refreshMembers()
        .then(() => this.refreshExpenses())
        .then(() => this.notify.setReady())
        .catch((error) => {
          this.notifyError(error);
        });
    });

    this.memberLoginService.showLoginPromptWithRouteParameter("expenseId");

  }

  private applyExpensesToView(apiResponse: ApiResponse) {
    const expenseClaims: ExpenseClaim[] = isArray(apiResponse.response) ? apiResponse.response : [apiResponse.response];
    this.logger.debug("Received", expenseClaims.length, "expense", apiResponse.action, "notification(s)");
    if (apiResponse.action === ApiAction.QUERY) {
      this.unfilteredExpenseClaims = expenseClaims;
    } else {
      this.logger.debug("unfilteredExpenseClaims size before", this.unfilteredExpenseClaims.length);
      expenseClaims.forEach(notifiedClaim => {
        this.unfilteredExpenseClaims = this.unfilteredExpenseClaims.filter(claim => claim.id !== notifiedClaim.id);
        if (apiResponse.action !== ApiAction.DELETE) {
          this.logger.debug("adding/replacing item", notifiedClaim);
          this.unfilteredExpenseClaims.push(notifiedClaim);
        } else {
          this.logger.debug("not adding", notifiedClaim, "as", apiResponse.action);
        }
      });
      this.logger.debug("unfilteredExpenseClaims size after", this.unfilteredExpenseClaims.length);
    }
    this.applyFilter();
  }

  applyFilter() {
    this.expenseClaims = chain(this.unfilteredExpenseClaims)
      .filter(expenseClaim => this.display.allowAdminFunctions() ? (this.selected.showOnlyMine ? this.display.memberOwnsClaim(expenseClaim) : true) : this.display.memberCanEditClaim(expenseClaim))
      .filter(expenseClaim => {
        return this.selected.filter.filter(expenseClaim);
      }).sortBy(expenseClaim => {
        const expenseClaimLatestEvent = this.display.expenseClaimLatestEvent(expenseClaim);
        return expenseClaimLatestEvent ? expenseClaimLatestEvent.date : true;
      }).value().reverse();
    const outcome = `found ${this.expenseClaims.length} expense claim(s)`;
    this.notify.progress({title: this.selected.filter.description, message: outcome});
    this.logger.debug("query finished", outcome);
    this.notify.clearBusy();
    this.selectFirstItem(first(this.expenseClaims));
  }

  private notifyError(error) {
    this.logger.error(typeof error);
    if (error.error && error.error.includes("CastError")) {
      this.noExpenseFound();
    } else {
      this.notify.error({title: "Expenses error", message: error});
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  defaultExpenseClaim(): ExpenseClaim {
    return cloneDeep({
      cost: 0,
      expenseItems: [],
      expenseEvents: []
    });
  }

  allowApproveExpenseClaim() {
    return this.memberLoginService.allowCommittee() && (this.approvalEvents().length === 0 && !this.display.expenseClaimHasEventType(this.selected.expenseClaim, this.display.eventTypes.paid));
  }

  lastApprovedByMe() {
    const approvalEvents = this.approvalEvents();
    return approvalEvents.length > 0 && last(approvalEvents).memberId === this.memberLoginService.loggedInMember().memberId;
  }

  approvalEvents() {
    if (!this.selected.expenseClaim) {
      return [];
    }
    return filter(this.selected.expenseClaim.expenseEvents, event => isEqual(event.eventType, this.display.eventTypes["first-approval"]) || isEqual(event.eventType, this.display.eventTypes["second-approval"]));
  }

  nextApprovalStage() {
    const approvals = this.approvalEvents();
    if (approvals.length === 0) {
      return "First Approval";
    } else if (approvals.length === 1) {
      return "Second Approval";
    } else {
      return "Already has " + approvals.length + " approvals!";
    }
  }

  confirmApproveExpenseClaim() {
    const approvals = this.approvalEvents();
    this.notifyConfirm.hide();
    if (approvals.length <= 1) {
      const request: ExpenseNotificationRequest = {
        notificationConfig: this.notificationConfig,
        notify: this.notify,
        notificationDirective: this.notificationDirective,
        expenseClaim: this.selected.expenseClaim,
        members: this.members,
        eventType: approvals.length === 0 ? this.display.eventTypes["first-approval"] : this.display.eventTypes["second-approval"]
      };
      this.notifications.createEventAndSendNotifications(request);
    } else {
      this.notifyError("This expense claim already has " + approvals.length + " approvals!");
    }
  }

  showAllExpenseClaims() {
    this.dataError = false;
    this.urlService.navigateTo(["admin", "expenses"]);
  }

  addExpenseClaim() {
    this.selectExpenseClaim(this.defaultExpenseClaim());
    this.display.createEvent(this.selected.expenseClaim, this.display.eventTypes.created);
    this.addExpenseItem();
  }

  selectFirstItem(expenseClaim: ExpenseClaim) {
    this.selectExpenseClaim(expenseClaim);
    if (!this.expenseItemSelected() && this.selected.expenseClaim) {
      this.selectExpenseItem(first(this.selected.expenseClaim.expenseItems));
    }
  }

  selectExpenseItem(expenseItem: ExpenseItem) {
    if (!this.notifyTarget.busy && this.confirm.noneOutstanding()) {
      this.logger.off("selectExpenseItem:", expenseItem);
      this.selected.expenseItem = expenseItem;
    }
  }

  selectExpenseClaim(expenseClaim: ExpenseClaim) {
    this.logger.off("selectExpenseClaim:", expenseClaim);
    if (!this.notifyTarget.busy && this.confirm.noneOutstanding()) {
      this.selected.expenseClaim = expenseClaim;
    }
  }

  editExpenseItem(expenseItem: ExpenseItem) {
    this.confirm.clear();
    this.selectExpenseItem(expenseItem);
    const expenseItemIndex = this.selected.expenseClaim.expenseItems.indexOf(this.selected.expenseItem);
    this.modalService.show(ExpenseDetailModalComponent, this.createModalOptions({
      expenseItemIndex,
      editable: this.display.editable(this.selected.expenseClaim),
      expenseItem: cloneDeep(this.selected.expenseItem),
    }));
  }

  addExpenseItem() {
    this.confirm.clear();
    const newExpenseItem = this.display.defaultExpenseItem();
    this.editExpenseItem(newExpenseItem);
  }

  allowClearError() {
    return this.expenseId && this.dataError;
  }

  allowReturnExpenseClaim() {
    return this.display.allowAdminFunctions()
      && this.confirm.noneOutstanding()
      && this.selected.expenseClaim
      && this.display.expenseClaimHasEventType(this.selected.expenseClaim, this.display.eventTypes.submitted)
      && !this.display.expenseClaimHasEventType(this.selected.expenseClaim, this.display.eventTypes.returned)
      && this.display.expenseClaimStatus(this.selected.expenseClaim).actionable;
  }

  approveExpenseClaim() {
    this.confirm.as(ConfirmType.APPROVE);
    if (this.lastApprovedByMe()) {
      this.notifyConfirm.warning({
        title: "Duplicate approval warning",
        message: `You were the previous approver, therefore ${this.nextApprovalStage()} ought to be carried out by someone else. Are you sure you want to do this?`
      });
    } else {
      this.notifyConfirm.hide();
    }
  }

  allowResubmitExpenseClaim() {
    return this.display.editable(this.selected.expenseClaim) && this.display.expenseClaimHasEventType(this.selected.expenseClaim, this.display.eventTypes.returned);
  }

  allowPaidExpenseClaim() {
    return this.memberLoginService.allowTreasuryAdmin() && [this.display.eventTypes["first-approval"].description]
      .includes(this.display.expenseClaimLatestEvent(this.selected.expenseClaim).eventType.description);
  }

  eventTracker(index: number, event: ExpenseEvent) {
    return event.date && event.eventType;
  }

  itemTracker(index: number, item: ExpenseItem) {
    return item.expenseDate && item.expenseType;
  }

  claimTracker(index: number, item: ExpenseClaim) {
    return item.id;
  }

  showExpenseDeleted() {
    return this.display.showExpenseSuccessAlert(this.notify, "Expense was deleted successfully");
  }

  confirmDeleteExpenseClaim() {
    this.display.showExpenseProgressAlert(this.notify, "Deleting expense claim", true);

    this.expenseClaimService.delete(this.selected.expenseClaim)
      .then(() => this.confirm.clear())
      .then(() => this.showExpenseDeleted())
      .then(() => this.notify.clearBusy());
  }

  submitExpenseClaim(resubmit: boolean) {
    this.modalService.show(ExpenseSubmitModalComponent, this.createModalOptions({resubmit}));
  }

  returnExpenseClaim() {
    this.modalService.show(ExpenseReturnModalComponent, this.createModalOptions());
  }

  allowSubmitExpenseClaim(expenseClaim: ExpenseClaim) {
    return this.display.allowEditExpenseItem(expenseClaim) && !this.allowResubmitExpenseClaim();
  }

  paidExpenseClaim() {
    this.modalService.show(ExpensePaidModalComponent, this.createModalOptions());
  }

  private createModalOptions(initialState?: any): ModalOptions {
    return {
      class: "modal-xl",
      animated: false,
      backdrop: "static",
      ignoreBackdropClick: false,
      keyboard: true,
      focus: true,
      show: true,
      initialState: extend({
        members: this.members,
        expenseClaim: cloneDeep(this.selected.expenseClaim),
        notificationDirective: this.notificationDirective
      }, initialState)
    };
  }

  resubmitExpenseClaim() {
    this.submitExpenseClaim(true);
  }

  refreshMembers() {
    if (this.memberLoginService.memberLoggedIn()) {
      this.notify.progress({title: "Expenses", message: "Refreshing member data..."});
      return this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS).then(members => {
        this.logger.debug("refreshMembers: found", members.length, "members");
        return this.members = members;
      });
    }
  }

  changeFilter($event?: ExpenseFilter) {
    this.logger.debug("changeFilter fired with", $event);
    this.selected.filter = $event;
    this.refreshExpenses();
  }

  query(): void {
    this.logger.debug("expenseFilter.description", this.selected.filter.description, "expenseId", this.expenseId);
    try {
      if (this.selected.filter.description === SELECTED_EXPENSE && this.expenseId) {
        this.expenseClaimService.getById(this.expenseId);
      } else {
        this.expenseClaimService.all();
      }
    } catch (error) {
      this.notifyError(error);
    }
  }

  noExpenseFound() {
    this.dataError = true;
    this.notify.warning({
      title: "Expense claim could not be found",
      message: "Try opening again from the link in the notification email, or click Show All Expense Claims"
    });
  }

  refreshExpenses() {
    this.dataError = false;
    this.notify.setBusy();
    this.notify.progress({title: this.selected.filter.description, message: "searching..."});
    this.logger.debug("refreshing expenseFilter", this.selected.filter);
    this.query();
  }

  allowAddExpenseClaim() {
    return !this.dataError && !this.unfilteredExpenseClaims.find(claim => this.display.editableAndOwned(claim));
  }

  cancelDeleteExpenseClaim() {

  }

  isInactive(expenseClaim: ExpenseClaim) {
    return expenseClaim !== this.selected.expenseClaim;
  }

  isActive(expenseClaim: ExpenseClaim) {
    return expenseClaim === this.selected.expenseClaim;
  }

  expenseItemSelected(): boolean {
    return isEmpty(this.selected.expenseClaim) ? false : this.selected.expenseClaim.expenseItems.includes(this.selected.expenseItem);
  }

  backToAdmin() {
    this.urlService.navigateTo(["admin"]);
  }

  expand() {
    this.expandable = false;
    this.showOrHide = "hide";
  }

  collapse() {
    this.expandable = true;
    this.showOrHide = "show";
  }

  toggle() {
    if (this.expandable) {
      this.expand();
    } else {
      this.collapse();
    }
  }
}
