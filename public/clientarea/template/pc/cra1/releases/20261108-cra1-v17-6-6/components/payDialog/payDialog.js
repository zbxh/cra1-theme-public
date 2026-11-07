function cra1CashierError(error) { return window.CRA1Shared?.Runtime?.error({message:error?.data?.msg || error?.response?.data?.msg || error?.message || '支付暂时不可用，请重试'}) || '支付暂时不可用，请重试'; }
// 线下支付弹窗
const proofDialog = {
  props: { pageMode: { type: Boolean, default: false } },
  template: /*html*/ `
      <!-- 上传凭证 -->
      <div >
    <component :is="pageMode ? 'section' : 'el-dialog'" v-if="!pageMode || proofDialog" custom-class='pay-dialog proof-dailog' :class="{look: isLook, 'cra1-cashier-surface cra1-cashier-proof': pageMode}" :visible.sync="proofDialog"
        :show-close="false" @close="proofClose">
        <template v-if="isLook">
            <div >
                <div class="dia-title">
                    <div class="title-text">{{lang.finance_custom19}}</div>
                </div>
                <div class="dia-content">
                    <div class="item">
                        <div class="view-box">
                            <p class="item" v-for="(item, index) in fileList" :key="index" @click="clickFile(item)">
                                {{item.name}}
                            </p>
                        </div>
                        <div class="dia-fotter">
                            <el-button class="cancel-btn" @click="proofClose">{{lang.finance_text58}}</el-button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div >
                <div class="dia-title">
                    <div class="title-text">{{lang.finance_custom6}}：{{zfData.orderId}}</div>
                    <div class="title-text">{{lang.pay_text2}}
                        <span class="pay-money">{{ commonData.currency_prefix }}
                            <span class="font-26">{{ Number(zfData.amount).toFixed(2)}}{{commonData.currency_suffix}}</span>
                        </span>
                        <i class="el-icon-circle-close close" @click="proofDialog = false"></i>
                    </div>
                </div>
                <div class="dia-content">
                    <div class="item">
                        <div class="pay-top">
                            <div class="pay-type" ref="payListRef">
                                <div class="type-item active">
                                    <img src="${url}img/common/bank.png" alt="" />
                                    <i class="el-icon-check"></i>
                                </div>
                            </div>
                        </div>
                        <div class="qr-money">
                            <span>{{lang.finance_custom11}}：</span>
                            <span class="pay-money">{{ commonData.currency_prefix}}
                                <span class="font-26">
                                    {{orderInfo.amount_unpaid}}{{commonData.currency_suffix}}
                                </span>
                            </span>
                        </div>
                        <p class="des">
                            ({{lang.finance_custom12}}：{{commonData.currency_prefix}}{{orderInfo.credit}}{{commonData.currency_suffix}})
                        </p>
                        <div class="custom-text">
                            <div class="qr-content" ref="payBox" v-loading="payLoading"></div>
                            <i class="el-icon-document-copy" v-if="payHtml" @click="copyText(payHtml)"></i>
                        </div>
                        <el-steps :space="200" :active="stepNum" finish-status="success" :align-center="true"
                            class="custom-step">
                            <el-step :title="lang.finance_custom7"></el-step>
                            <el-step :title="lang.finance_custom4"></el-step>
                            <el-step>
                                <template slot="title">
                                    <span class="txt" :class="{ fail: orderStatus === 'ReviewFail'}">{{orderStatus === 'ReviewFail'
                      ? lang.finance_custom9 : lang.finance_custom8}}</span>
                                    <el-popover placement="top-start" trigger="hover" :title="review_fail_reason">
                                        <span class="help" slot="reference" v-if="orderStatus === 'ReviewFail'">?</span>
                                    </el-popover>
                                </template>
                            </el-step>
                            <el-step :title="lang.finance_custom10"></el-step>
                        </el-steps>
                    </div>
                    <div class="item" v-if="orderStatus === 'WaitUpload' || orderStatus === 'ReviewFail'">
                        <p>{{lang.finance_custom4}}</p>
                        <el-upload class="upload-demo" ref="fileupload" drag action="/console/v1/upload"
                            :headers="{Authorization: jwt}" :before-remove="beforeRemove" multiple :file-list="fileList"
                            :on-success="handleSuccess" :on-preview="clickFile" :limit="10"
                            accept="image/*, .pdf, .PDF">
                            <div class="el-upload__text">
                                <p>{{lang.finance_custom16}}<em>{{lang.finance_custom17}}</em></p>
                                <p>{{lang.finance_custom18}}</p>
                            </div>
                        </el-upload>

                        <div class="dia-fotter">
                            <el-button class="cancel-btn" @click="changeWay">{{lang.finance_custom14}}</el-button>
                            <el-button @click="submitProof" :disabled="formData.voucher.length === 0" class="submit-btn"
                                :loading="submitLoading">
                                {{orderStatus === 'WaitUpload' ? lang.finance_custom4 : lang.finance_custom5}}
                            </el-button>
                        </div>
                    </div>
                    <div v-if="orderStatus === 'WaitReview'" class="dia-fotter"><el-button class="cancel-btn" @click="proofClose">{{lang.finance_text58}}</el-button></div>
                </div>
            </div>
        </template>
    </component>
    <!-- 图片预览 -->
    <div style="height: 0;">
        <img id="proofViewer" :src="preImg" alt="" ref="proofViewer" style="width: 0; height: 0;">
    </div>
    <!-- 变更支付方式 -->
    <div class="delete-dialog">
        <el-dialog width="4.35rem" :visible.sync="showChangeWay" :show-close=false @close="showChangeWay=false">
            <div class="delete-box">
                <div class="delete-content">{{lang.finance_custom15}}</div>
                <div class="delete-btn">
                    <el-button class="confirm-btn btn" @click="handelChangeWay"
                        :loading="changeLoading">{{lang.finance_btn8}}</el-button>
                    <el-button class="cancel-btn btn" @click="showChangeWay=false">{{lang.finance_btn7}}</el-button>
                </div>
            </div>
        </el-dialog>
    </div>
</div>
    `,
  computed: {
    srcList() {
      return this.formData.voucher;
    },
  },
  created() {
    this.commonData =
      (window.CRA1Shared.Runtime ? window.CRA1Shared.Runtime.common() : JSON.parse(localStorage.getItem("common_set_before"))) || {};
  },
  data() {
    return {
      proofDialog: false,
      zfData: {
        orderId: 0,
        amount: 0,
      },
      commonData: {
        currency_prefix: "￥",
      },
      orderInfo: {},
      stepNum: 0,
      orderStatus: "",
      review_fail_reason: "",
      payLoading: false,
      payHtml: "",
      fileList: [],
      jwt: `Bearer ${localStorage.jwt}`,
      formData: {
        id: "",
        voucher: [],
      },
      submitLoading: false,
      showChangeWay: false,
      changeLoading: false,
      viewer: null,
      preImg: "",
      isLook: false,
    };
  },
  beforeDestroy() { this._cra1Destroyed=true;this._cra1ProofGeneration=(this._cra1ProofGeneration||0)+1;this.viewer?.destroy();this.viewer=null; },
  methods: {
    loadViewer() {
      if (!this.viewer) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${url}css/common/viewer.min.css`;
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = `${url}js/common/viewer.min.js`;
        document.head.appendChild(script);
        script.onload = () => {
          if(this._cra1Destroyed || !this.proofDialog)return;
          this.viewer = new Viewer(document.getElementById("proofViewer"), {
            button: true,
            inline: false,
            zoomable: true,
            title: true,
            tooltip: true,
            minZoomRatio: 0.5,
            maxZoomRatio: 100,
            movable: true,
            interval: 2000,
            navbar: true,
            loading: true,
          });
          this.viewer.show();
        };
      } else {
        this.viewer.show();
      }
    },
    proofClose() {
      this.$refs.fileupload?.abort();
      this._cra1ProofGeneration=(this._cra1ProofGeneration||0)+1;
      this.proofDialog = false;
      this.viewer && this.viewer.destroy(); this.viewer = null;
      this.$emit("closed");
    },
    changeWay() {
      this.showChangeWay = true;
    },
    // 附件下载
    clickFile(item) {
      const name = item.name;
      const imgUrl = item.url || item.response?.data?.image_url;
      const type = name.substring(name.lastIndexOf(".") + 1);
      if (
        [
          "png",
          "jpg",
          "jepg",
          "bmp",
          "webp",
          "PNG",
          "JPG",
          "JEPG",
          "BMP",
          "WEBP",
        ].includes(type)
      ) {
        this.preImg = imgUrl;
        $("#proofViewer").attr("src", imgUrl);
        this.loadViewer();
      } else {
        const downloadElement = document.createElement("a");
        downloadElement.href = imgUrl;
        downloadElement.download = item.name; // 下载后文件名
        document.body.appendChild(downloadElement);
        downloadElement.click(); downloadElement.remove(); // 点击下载
      }
    },
    emitRefresh(isChange = false) {
      this.$emit("refresh", isChange, this.orderInfo.id);
    },
    copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        // navigator clipboard 向剪贴板写文本
        this.$message.success(lang.pay_text17);
        return navigator.clipboard.writeText(text);
      } else {
        // 创建text area
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // 使text area不在viewport，同时设置不可见
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        this.$message.success(lang.pay_text17);
        return new Promise((res, rej) => {
          // 执行复制命令并移除文本框
          document.execCommand("copy") ? res() : rej();
          textArea.remove();
        });
      }
    },
    async handelChangeWay() {
      const generation=this._cra1ProofGeneration;
      const current=()=>!this._cra1Destroyed && generation===this._cra1ProofGeneration;
      if(this.changeLoading)return;
      try {
        this.changeLoading = true;
        const res = await changePayType(this.orderInfo.id);
        if(!current())return;
        this.$message.success(res.data.msg);
        this.showChangeWay = false;
        this.proofDialog = false;
        this.changeLoading = false;
        this.emitRefresh(true);
      } catch (error) {
        if(!current())return;
        this.changeLoading = false;
        this.showChangeWay = false;
        this.$message.error(cra1CashierError(error));
      }
    },
    onProgress(event) {
    },
    async submitProof() {
      const generation=this._cra1ProofGeneration;
      const current=()=>!this._cra1Destroyed && generation===this._cra1ProofGeneration;
      if(this.submitLoading)return;
      try {
        if (this.formData.voucher.length === 0 || !["WaitUpload","ReviewFail"].includes(this.orderStatus)) {
          return this.$message.warning(lang.finance_custom13);
        }
        this.submitLoading = true;
        const params = {
          id: this.zfData.orderId,
          voucher: this.formData.voucher,
        };
        const res = await uploadProof(params);
        if(!current())return;
        this.submitLoading = false;
        this.$message.success(res.data.msg);
        this.proofDialog = false;
        this.emitRefresh();
      } catch (error) {
        if(!current())return;
        this.submitLoading = false;
        this.$message.error(cra1CashierError(error));
      }
    },
    beforeRemove(file, fileList) {
      // 获取到删除的 save_name
      let save_name = file.save_name || file.response?.data?.save_name;
      this.formData.voucher = this.formData.voucher.filter((item) => {
        return item != save_name;
      });
    },
    // 上传文件相关
    handleSuccess(response, file, fileList) {
      if(this._cra1Destroyed || !this.proofDialog)return;
      if (response.status != 200) {
        this.$message.error(cra1CashierError({message:response.msg}));
        // 清空上传框
        let uploadFiles = this.$refs["fileupload"].uploadFiles;
        let length = uploadFiles.length;
        uploadFiles.splice(length - 1, length);
      } else {
        this.formData.voucher = [];
        this.formData.voucher = fileList.map(
          (item) => item.response?.data?.save_name || item.save_name,
        );
      }
    },
    async getOrderDetails(orderId) {
      const generation=this._cra1ProofGeneration=(this._cra1ProofGeneration||0)+1;
      const current=()=>!this._cra1Destroyed && generation===this._cra1ProofGeneration;
      this.$refs.fileupload?.abort();
      this.submitLoading=false;this.changeLoading=false;this.showChangeWay=false;
      this.fileList=[];this.formData.voucher=[];
      try {
        const res = await orderDetails(orderId);
        if(!current())return;
        if(res.data?.status!==200||!res.data?.data?.order?.id)throw new Error("支付信息暂不可用，请重试");
        this.orderInfo = res.data.data.order;
        this.$emit('state', this.orderInfo);

        const {id, amount, status, review_fail_reason} = res.data.data.order;
        this.zfData.orderId = Number(id);
        this.zfData.amount = amount;
        this.proofDialog = true;
        this.orderStatus = status;
        this.review_fail_reason = review_fail_reason ? cra1CashierError({message:review_fail_reason}) : "";
        this.isLook = status === "Paid" && (this.orderInfo.voucher || []).length > 0;
        if (status === "WaitUpload") {
          this.stepNum = 2;
        } else {
          this.stepNum = 3;
        }
        // 获取转账信息
        this.payLoading = true;
        let result = "";
        if (!this.isLook) {
          result = await pay({
            id,
            gateway: "UserCustom",
          });
          if(!current())return;
          this.payLoading = false;
          this.payHtml = result.data.data.html;
          this.$nextTick(() => {
            if (current() && this.$refs.payBox) {
              $(this.$refs.payBox).html(this.payHtml);
            }
          });
        }

        this.fileList = this.orderInfo.voucher || [];
        this.formData.voucher = (this.orderInfo.voucher || []).map(
          (item) => item.save_name,
        );
      } catch (error) {
        if(!current())return;
        this.$message.error(cra1CashierError(error));
        this.payLoading = false;
      }
    },
  },
};

// 选择平台币弹窗
const selectCoin = {
  template: /*html*/ `
    <div >
    <el-dialog :visible.sync="selectCoinShow" custom-class="select-coin-dialog" :show-close="false"
        @close="handelAllPay">
        <div class="select-coin-title">
            <span class="title-text">{{lang.coin_text32}}{{coin_name}}</span>
            <span class="close-btn" @click="closeSelectDialog">
                <i class="el-icon-close"></i>
            </span>
        </div>
        <div class="select-coin-box" v-loading="selectCoinLoading">
            <div class="select-coin-box-top" v-if="coinList.length > 0">
                <div class="select-coin-num">{{lang.coin_text33}}{{coin_name}}({{lang.coin_text34}}：<span class="select-coin-num-price">{{commonData.currency_prefix}}{{coin_amount}}</span> ，{{lang.coin_text35}}{{auto ? coin_coupons_count : coin_coupon_ids.length}}{{lang.coin_text36}},{{lang.coin_text37}}<span
                        class="select-coin-num-text">{{coinList.length}}{{lang.coin_text36}}</span>)</div>
                <div class="select-coin-auto">
                    <el-checkbox v-model="auto" @change="autoChange">{{lang.coin_text38}}</el-checkbox>
                </div>
            </div>
            <el-checkbox-group v-model="coin_coupon_ids" @change="coinChange">
                <div class="select-coin-list">
                    <div class="select-coin-item" v-for="item in coinList" :key="item.id">
                        <div class="select-item-left">
                            <div class="select-item-info">
                                <span class="f-small">
                                {{commonData.currency_prefix}}<span :class="{'f-20':item.leave_amount.length >= 8,'f-40':item.leave_amount.length < 5,'f-32':item.leave_amount.length < 8 && item.leave_amount.length >= 5}" v-if="String(item.leave_amount).split('.')?.[0]">{{String(item.leave_amount).split('.')[0]}}</span>
                                  <span class="f-small" v-if="String(item.leave_amount).split('.')?.[1]">.{{String(item.leave_amount).split('.')[1]}}</span>
                                </span>
                            </div>
                        </div>
                        <div class="select-item-right">
                            <div class="coin-name">{{item.name}}</div>
                            <div class="coin-price" v-if="item.discount_amount > 0 && (coin_coupon_ids.includes(item.id) || auto)">
                              {{lang.coin_text39}}：{{commonData.currency_prefix}}{{item.discount_amount.toFixed(2)}}
                            </div>
                            <div class="coin-time">{{lang.coin_text40}}：
                                <template v-if="!item.effective_start_time">
                                    {{lang.voucher_effective}}
                                </template>
                                <template v-else>
                                    {{item.effective_start_time | formateTime}} -
                                    {{item.effective_end_time | formateTime}}
                                </template>
                            </div>
                        </div>
                        <el-checkbox class="select-coin-checkbox" :label="item.id" v-if="!auto">{{ }}</el-checkbox>
                    </div>
                </div>
            </el-checkbox-group>
            <el-empty v-if="coinList.length === 0 && !selectCoinLoading" :description="lang.coin_text41 + coin_name" :image-size="150"></el-empty>
        </div>
        <div class="select-coin-footer">
            <el-button type="primary" @click="closeSelectDialog">{{lang.coin_text42}}</el-button>
        </div>
    </el-dialog>

</div>
  `,
  data() {
    return {
      commonData: {},
      selectCoinShow: false,
      coin_coupon_ids: [],
      auto: false,
      selectCoinLoading: false,
      orderId: "",
      coinList: [],
      coin_amount: 0,
      coin_coupons_count: 0,
      coin_name: lang.coin_text43,
    };
  },
  filters: {
    formateTime(time) {
      if (time && time !== 0) {
        return formateDate1(time * 1000);
      } else {
        return lang.voucher_effective;
      }
    },
  },
  created() {
    this.commonData =
      (window.CRA1Shared.Runtime ? window.CRA1Shared.Runtime.common() : JSON.parse(localStorage.getItem("common_set_before"))) || {};
  },
  methods: {
    autoChange(val) {
      if (val) {
        this.coin_coupon_ids = this.coinList.map((item) => item.id);
      } else {
        this.coin_coupon_ids = [];
      }
      this.applyCoin();
    },
    coinChange() {
      this.applyCoin();
    },
    async getCoinPayList() {
      this.selectCoinLoading = true;
      try {
        const res = await apiCoinPayList({
          order_id: this.orderId,
        });
        this.coinList = res.data.data.list.map((item) => {
          item.discount_amount = 0;
          return item;
        });
        this.selectCoinLoading = false;
      } catch (error) {
        this.selectCoinLoading = false;
      }
    },
    handelAllPay() {
      this.$emit("confirm", {
        auto: this.auto,
        coin_coupon_ids: this.coin_coupon_ids,
      });
    },
    async openSelectDia(
      coin_name = lang.coin_text43,
      id,
      auto = true,
      coin_coupon_ids = [],
    ) {
      this.coin_name = coin_name;
      this.auto = auto;
      this.orderId = id;
      this.coin_coupon_ids = coin_coupon_ids;
      this.selectCoinShow = true;
      await this.getCoinPayList();
      await this.applyCoin();
    },
    // 应用平台币
    async applyCoin() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        this.selectCoinLoading = true;
        const res = await apiApplyCoin({
          order_id: this.orderId,
          use: this.auto || this.coin_coupon_ids.length > 0 ? 1 : 0,
          auto: Number(this.auto),
          coin_coupon_ids: this.coin_coupon_ids,
        });
        if(!cra1Current())return;
        const {
          coin_amount = 0,
          coin_coupons_count = 0,
          coin_coupons = [],
        } = res.data.data;
        this.coin_amount = coin_amount;
        this.coin_coupons_count = coin_coupons_count;
        this.coinList.forEach((item) => {
          item.discount_amount = 0;
          coin_coupons.forEach((coin) => {
            if (coin.rel_id == item.id) {
              item.discount_amount =
                item.discount_amount + Math.abs(coin.amount);
            }
          });
        });
        this.selectCoinLoading = false;
      } catch (error) {
        if(!cra1Current())return;
        this.selectCoinLoading = false;
        this.coin_amount = 0;
        this.coin_coupons_count = 0;
        this.$message.error(cra1CashierError(error));
      }
    },
    closeSelectDialog() {
      this.selectCoinShow = false;
    },
  },
};

// 通用支付弹窗
const payDialog = {
  template: /*html*/ `
  <div>
  <component :is="pageMode ? 'section' : 'el-dialog'" v-if="!pageMode || isShowZf" :class="{'cra1-cashier-surface': pageMode}" custom-class='new-pay-dialog' :visible.sync="isShowZf" :show-close="false" @close="zfClose">
      <div class="pay-title">
          <span class="title-text">{{pageMode ? '选择付款方式' : lang.coin_text24}}</span>
          <span class="close-btn" v-if="!pageMode" @click="zfClose">
              <i class="el-icon-close"></i>
          </span>
      </div>
      <div class="pay-content">
          <div class="pay-order-top">
              <div class="pay-order-top-left">
                  <i class="el-icon-circle-check pay-order-icon"></i>
                  <div class="pay-order-tip">
                      <div class="pay-order-tip-text">
                          {{pageMode ? '请在有效时间内完成付款' : lang.coin_text25}}
                          <span v-if="orderData.unpaid_timeout > 0">{{lang.coin_text137}}：{{formattedRemainTime}}</span>
                      </div>
                      <div class="pay-order-id">
                          {{lang.coin_text26}}：ID-{{zfData.orderId}}
                      </div>
                  </div>
              </div>
              <div class="pay-order-top-right">
                  <div>
                      <template v-if="zfData.gateway == 'UserCustom'">{{lang.pay_text7}}</template>
                      <template v-else-if="zfData.gateway == 'credit'">{{lang.order_text8}}</template>
                      <template v-else-if="zfData.gateway == 'CreditLimit'">{{lang.coin_text62}}</template>
                      <template v-else>{{lang.pay_text8}}</template>{{lang.coin_text27}}：{{commonData.currency_prefix}}
                      <span class="pay-order-price" v-loading="priceLoading">
                          {{calcPayAmount}}
                      </span>
                      {{commonData.currency_suffix}}
                  </div>
                  <div>
                      {{lang.coin_text28}}：{{ commonData.currency_prefix}}<span class="pay-order-total-price"
                          v-loading="priceLoading">{{calcShowOriginAmount}}</span>{{commonData.currency_suffix}}
                  </div>
              </div>
          </div>
          <div class="pay-order-des" v-if="commonData.recharge_pay_notice_content && isCz"
              v-html="commonData.recharge_pay_notice_content">
          </div>
          <div class="pay-order-check" v-if="!isCz">
              <div style="display: flex;align-items: center;">
                  <span v-if="!pageMode" style="margin-right: 0.16rem;">{{lang.coin_text23}}</span>
                  <el-checkbox v-if="zfData.gateway !== 'credit' && zfData.gateway !== 'CreditLimit' && balance * 1 > 0 && order_customfields?.is_pre_invoice !== 1" :disabled="priceLoading || diaInitIng || doPayLoading" v-model="zfData.checked" @change="zfSelectChange">
                      {{lang.pay_text21}}
                      ({{lang.pay_text6}}{{ commonData.currency_prefix}}
                      <span class="pay-order-balance">{{(balance * 1).toFixed(2)}}</span>
                      <template v-if="zfData.checked">
                           ,{{lang.order_text8}}{{ commonData.currency_prefix}}
                          <span
                              class="pay-order-balance">{{(balance * 1 >= zfData.amount * 1 ? zfData.amount * 1 : balance * 1).toFixed(2)}}</span>
                      </template>
                      )
                  </el-checkbox>
              </div>
              <div v-plugin="'Coin'" v-if="showCoin" style="display: flex;align-items: baseline;">
                  <el-checkbox :disabled="priceLoading || diaInitIng || doPayLoading" v-model="useCoin" @change="checkUseCoin"
                      style="margin-right: 5px;line-height: 1;"></el-checkbox>
                  {{lang.coin_text44}}{{coin_name}}
                  <template v-if="useCoin">
                      ({{lang.coin_text35}}{{coin_coupons_count}}{{lang.coin_text36}},{{lang.coin_text45}}{{
                      commonData.currency_prefix}}<span class="pay-order-coin-num">{{coin_amount}}</span> <span
                          class="pay-order-coin-detail" @click.stop="openSelectDialog">{{lang.coin_text46}}</span>)
                  </template>

              </div>
          </div>
          <div class="credit-tip" v-if="zfData.gateway == 'CreditLimit'">{{lang.pay_text4}}</div>
          <div class="pay-order-method" v-loading="getWayLoading">
              <div class="pay-method-list">
                  <button type="button" class="pay-method-item" :class="{active:zfData.gateway === item.name, 'is-mobile-hidden':pageMode && !moreGateways && index > 1 && zfData.gateway !== item.name}"
                      :aria-pressed="zfData.gateway === item.name" :disabled="priceLoading || diaInitIng || doPayLoading"
                      v-for="(item,index) in gatewayList" :key="item.name" @click="handelSelect(item)">
                      <img class="pay-method-item-img" :src="item.url" v-if="item.url && !brokenLogos[item.name]" alt="" @error="$set(brokenLogos,item.name,true)">
                      <i class="el-icon-bank-card pay-method-fallback" v-else aria-hidden="true"></i>
                      <div class="pay-method-item-text">
                          <div>{{item.title}}</div>
                          <div v-if="isShowCredit && item.name === 'CreditLimit'">
                              ({{ commonData.currency_prefix}}{{creditData.remaining_amount}})
                          </div>
                          <div class="type-dec" v-if="item.name === 'credit'">
                              ({{ commonData.currency_prefix}}{{balance}})
                          </div>
                      </div>
                      <i class="el-icon-check" v-if="zfData.gateway === item.name"></i>
                  </button>
              </div>
              <button type="button" class="cra1-more-gateways" v-if="pageMode && gatewayList.length > 2" :aria-expanded="moreGateways" @click="moreGateways=!moreGateways">{{moreGateways ? '收起支付方式' : '更多支付方式'}} <i :class="moreGateways ? 'el-icon-arrow-up' : 'el-icon-arrow-down'" aria-hidden="true"></i></button>
              <div class="pay-method-box" v-show="isShowPay && !gatewayError && zfData.gateway !== 'CreditLimit'">
                  <!-- 线下支付 -->
                  <div class="pay-method-offline" v-if="zfData.gateway === 'UserCustom'">
                      <div class="custom-text-title">{{lang.coin_text29}}</div>
                      <div class="custom-text-content">
                          <div class="qr-content" ref="payBox" v-loading="payLoading || loading">
                          </div>
                          <i class="el-icon-document-copy" v-if="payHtml" @click="copyText(payHtml)"></i>
                      </div>
                      <el-steps :space="200" :active="1" finish-status="success" :align-center="true"
                          class="custom-offline-step">
                          <el-step :title="lang.finance_custom7"></el-step>
                          <el-step :title="lang.finance_custom4"></el-step>
                          <el-step :title="lang.finance_custom8"></el-step>
                          <el-step :title="lang.finance_custom10"></el-step>
                      </el-steps>
                      <el-button type="primary" class="custom-btn" :loading="submitLoading"
                          @click="handleCustom">{{lang.finance_custom20}}
                      </el-button>
                  </div>
                  <!-- 扫码支付 -->
                  <div class="pay-method-qr" v-if="zfData.gateway !== 'UserCustom'">
                      <div class="pay-qr-content">
                          <div class="qr-content" ref="payBox" v-loading="payLoading || loading"
                              v-show="isShowimg && zfData.gateway !== 'UserCustom'">
                          </div>
                          <p class="pay-qr-text" v-if="!pageMode">{{lang.coin_text30}}<br>{{lang.coin_text31}}</p>
                      </div>
                  </div>
              </div>
          </div>
          <div v-if="gatewayError" role="alert" style="padding:16px;text-align:center">
              <p>页面错误，请刷新重试</p>
          </div>
      </div>
      <div class="pay-footer">
          <div class="pay-footer-left">
           <template v-if="showCoupon">
            <span style="flex-shrink: 0;">{{lang.shoppingCar_tip_text10}}：</span>
             <el-select :disabled="priceLoading || diaInitIng || doPayLoading" v-model="selectedCouponId" style="width:250px;" clearable  :placeholder="lang.shoppingCar_tip_text11" :loading="couponListLoading" 
              @change="handleVoucherChange"
             >
              <el-option v-for="item in couponList" :key="item.id"  :label="formatLabel(item)"  :value="item.id">
                {{item.code}} ({{commonData.currency_prefix}}{{item.price}})
              </el-option>
            </el-select>
            </template>
          </div>
          <div class="pay-footer-right">
            <el-button type="primary" @click="handleOk" v-loading="doPayLoading"
              :disabled="doPayLoading || diaInitIng || !zfData.gateway || getWayLoading || priceLoading || (balance * 1 < zfData.amount *1) && zfData.gateway !== 'CreditLimit'"
              v-if="!isShowPay || zfData.gateway === 'CreditLimit'">{{lang.pay_text9}}
            </el-button>
            <el-button v-if="!pageMode" type="info" class="cancel-btn" @click="zfClose">{{lang.pay_text12}}</el-button>
            <el-button v-if="pageMode && isShowPay && zfData.gateway !== 'UserCustom' && zfData.gateway !== 'CreditLimit' && !gatewayError" :disabled="checkingPayment" @click="checkPayment">{{checkingPayment ? '正在核实…' : '我已付款，查询结果'}}</el-button>
          </div>
      </div>
  </component>
  <proof-dialog ref="proof" :page-mode="pageMode" @state="proofState" @refresh="refresh" @closed="proofClosed"></proof-dialog>
  <select-coin ref="selectCoinRef" @confirm="confirmCoin"></select-coin>
</div>

    `,
  created() {
    this.commonData =
      (window.CRA1Shared.Runtime ? window.CRA1Shared.Runtime.common() : JSON.parse(localStorage.getItem("common_set_before"))) || {};
  },
  components: {
    proofDialog,
    selectCoin,
  },
  beforeDestroy() { this._cra1Destroyed=true; this.clearPolling(); this._cra1PayGeneration=(this._cra1PayGeneration || 0)+1; },
  destroyed() {
    clearInterval(this.timer);
    clearInterval(this.countdownTimer);
    clearTimeout(this.balanceTimer);
  },
  props: {
    pageMode: { type: Boolean, default: false },
    initialGateway: { type: String, default: '' },
    allowCredit: {
      // 是否允许使用信用额
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      // 显示弹窗
      isShowZf: false,
      moreGateways: false,
      brokenLogos: {},
      checkingPayment: false,
      serverPayable: null,
      // 显示底部支付按钮
      isShowPay: false,
      timer: null,
      time: 300000,
      zfData: {
        // 订单id
        orderId: 0,
        // 订单金额
        amount: 0,
        checked: false,
        // 支付方式
        gateway: "",
      },
      // 订单数据
      orderData: {
        unpaid_timeout: 0,
        remain_pay_time: 0,
      },
      // 倒计时定时器
      countdownTimer: null,
      order_customfields: {},
      // 支付方式
      gatewayList: [],
      payLoading: false,
      isShowCredit: false,
      cantUseCredit: false,
      isShowimg: true,
      creditData: {},
      // 用户余额
      balance: 0,
      payHtml: "",
      gatewayError: "",
      balanceTimer: null,
      commonData: {
        currency_prefix: "￥",
      },
      isPaySuccess: false,
      isCz: false,
      doPayLoading: false,
      loading: false,
      str: "",
      submitLoading: false,
      isTransfer: false,
      useCoin: false,
      auto: false,
      coin_coupon_ids: [],
      coin_coupons_count: 0,
      coin_amount: 0,
      showCoin: false,
      diaInitIng: false,
      priceLoading: false,
      coin_name: lang.coin_text43,
      getWayLoading: false,
      coinClientInfo: {},
      showCoupon: false,
      selectedCouponId: "",
      couponList: [],
      couponListLoading: false,
      voucher_amount: 0,
    };
  },
  computed: {
    calcPayAmount() {
      const balance = this.zfData.checked ? Number(this.balance) : 0;
      const showAmount = this.zfData.amount * 1 - balance;
      if (
        this.zfData.gateway == "credit" ||
        this.zfData.gateway == "CreditLimit"
      ) {
        return Number(this.zfData.amount).toFixed(2);
      } else {
        if(this.serverPayable!==null)return Number(this.serverPayable).toFixed(2);
        return showAmount <= 0 ? "0.00" : showAmount.toFixed(2);
      }
    },
    calcShowOriginAmount() {
      return Number(this.zfData.amount * 1 + this.coin_amount * 1).toFixed(2);
    },
    // 格式化剩余支付时间
    formattedRemainTime() {
      const seconds = this.orderData.remain_pay_time;
      if (!seconds || seconds <= 0) return "";

      const year = Math.floor(seconds / (365 * 24 * 3600));
      const month = Math.floor(
        (seconds % (365 * 24 * 3600)) / (30 * 24 * 3600),
      );
      const day = Math.floor((seconds % (30 * 24 * 3600)) / (24 * 3600));
      const hour = Math.floor((seconds % (24 * 3600)) / 3600);
      const minute = Math.floor((seconds % 3600) / 60);
      const second = seconds % 60;

      let result = [];
      if (year > 0) result.push(`${year}${lang.coin_text139}`);
      if (month > 0) result.push(`${month}${lang.coin_text140}`);
      if (day > 0) result.push(`${day}${lang.coin_text141}`);
      if (hour > 0) result.push(`${hour}${lang.coin_text142}`);
      if (minute > 0) result.push(`${minute}${lang.coin_text143}`);
      if (second > 0) result.push(`${second}${lang.coin_text144}`);

      return result.join("");
    },
  },
  filters: {
    formateDownTime(time) {
      let minutes = Math.floor(time / 1000 / 60);
      let seconds = (time / 1000) % 60;
      return minutes + "分" + seconds + "秒";
    },
  },
  watch: {
    calcPayAmount() { this.publishState(); },
    coin_amount() { this.publishState(); },
    voucher_amount() { this.publishState(); },
  },
  methods: {
    publishState() {
      this.$emit('paystate', {order:this.orderData, amount:this.zfData.amount, payable:this.calcPayAmount, balance:Number(this.orderData.credit)||0, coin:this.coin_amount, voucher:this.voucher_amount});
    },
    proofState(order) {
      if(this._cra1Destroyed || String(order.id)!==String(this.zfData.orderId))return;
      this.orderData=order;this.zfData.amount=order.amount;
      this.serverPayable=order.amount_unpaid==null?null:Number(order.amount_unpaid);this.publishState();
    },
    paid(id) {
      this.clearPolling();clearInterval(this.countdownTimer);this.isPaySuccess=true;this.isShowZf=false;this.diaInitIng=false;
      this.$emit('payok',id);
    },
    async checkPayment() {
      if(this.checkingPayment)return;
      this.clearPolling(false);this.checkingPayment=true;
      const generation=this._cra1PayGeneration, selection=this._cra1SelectGeneration, id=this.zfData.orderId;
      try {
        const res=await this.readPaymentStatus(id);
        if(this._cra1Destroyed || generation!==this._cra1PayGeneration || selection!==this._cra1SelectGeneration)return;
        if(res.data.status===200 && (res.data.code==='Paid'||res.data.data?.code==='Paid'))this.paid(id);
        else if(Number(res.data.status)===400) {this.gatewayError='当前支付已失效，请重新读取订单后再试';}
        else {this.$message.info('暂未收到付款结果，请稍后再查询');this.pollingStatus(id);}
      } catch(error) {
        if(!this._cra1Destroyed && generation===this._cra1PayGeneration && selection===this._cra1SelectGeneration){this.$message.error(cra1CashierError(error));if(![400,401].includes(Number(error?.data?.status||error?.status)))this.pollingStatus(id);}
      } finally {if(!this._cra1Destroyed)this.checkingPayment=false;}
    },
    readPaymentStatus(id) {
      if(this._cra1StatusRequest)return this._cra1StatusRequest;
      const controller=new AbortController();this._cra1StatusAbort=controller;
      const request=window.CRA1Shared?.Request
        ? window.CRA1Shared.Request.request('/pay/'+id+'/status',{signal:controller.signal}).then(data=>({data}))
        : getPayStatus(id);
      const pending=Promise.resolve(request).finally(()=>{if(this._cra1StatusRequest===pending){this._cra1StatusRequest=null;this._cra1StatusAbort=null;}});
      this._cra1StatusRequest=pending;return pending;
    },
    openSelectDialog() {
      this.$refs.selectCoinRef.openSelectDia(
        this.coin_name,
        this.zfData.orderId,
        this.auto,
        this.coin_coupon_ids,
      );
    },
    checkUseCoin(val) {
      if (val) {
        this.auto = true;
      } else {
        this.auto = false;
        this.coin_coupon_ids = [];
      }
      this.applyCoin();
    },
    confirmCoin(data) {
      this.useCoin = data.auto || data.coin_coupon_ids.length > 0;
      this.coin_coupon_ids = data.coin_coupon_ids;
      this.auto = data.auto;
      this.applyCoin();
    },
    // 应用平台币
    async applyCoin(isInit = false) {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        this.priceLoading = true;
        const res = await apiApplyCoin({
          order_id: this.zfData.orderId,
          use: Number(this.useCoin),
          auto: Number(this.auto),
          coin_coupon_ids: this.coin_coupon_ids,
        });
        if(!cra1Current())return;
        const {coin_amount = 0, coin_coupons_count = 0} = res.data.data;
        this.coin_amount = coin_amount;
        this.coin_coupons_count = coin_coupons_count;
        const detailRes = await orderDetails(this.zfData.orderId);
        if(!cra1Current())return;
        const orderData = detailRes.data.data.order;
        if(!orderData?.id || !Number.isFinite(Number(orderData.amount)))throw new Error('订单信息暂时无法读取，请从订单详情重新打开');
        this.zfData.amount = orderData.amount;
        this.priceLoading = false;
        if (isInit === false) {
          this.zfSelectChange();
        }
      } catch (error) {
        if(!cra1Current())return;
        this.priceLoading = false;
        this.coin_amount = 0;
        this.coin_coupons_count = 0;
        this.$message.error(cra1CashierError(error));
        if (isInit === false) {
          this.zfSelectChange();
        }
      }
    },
    async handleCustom() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      if(this.submitLoading || this.priceLoading || this.diaInitIng)return;
      try {
        this.submitLoading = true;
        const res = await submitApplication(this.zfData.orderId);
        if(!cra1Current())return;
        this.$message.success(res.data.msg);
        this.submitLoading = false;
        this.isTransfer = true;
        this.$refs.proof.getOrderDetails(this.zfData.orderId);
        this.isShowZf = false;
      } catch (error) {
        if(!cra1Current())return;
        this.submitLoading = false;
        this.$message.error(cra1CashierError(error));
      }
    },
    proofClosed() { if (!this._cra1ProofSwitch && this.isTransfer) this.$emit('paypending', this.zfData.orderId); },
    refresh(bol, id) {
      if (bol) {
        this._cra1ProofSwitch=true;
        this.$nextTick(() => { this._cra1ProofSwitch=false; });
        return this.showPayDialog(id);
      }
      this.$emit("paypending", this.zfData.orderId);
    },
    async initPay() {
      this.isShowCredit = havePlugin("CreditLimit");
      // 清除已有定时器
      if (this.timer) {
        clearInterval(this.timer);
      }
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
      }
      this.time = 300000;
      this.gatewayList = [];
      this.balance = 0;
      this.zfData.gateway = "";
      this.zfData.checked = false;
      this.serverPayable=null;
      this.zfData.orderId = 0;
      this.zfData.amount = 0;
      this.isPaySuccess = false;
      this.isTransfer = false;
      this.isShowPay = false;
      this.gatewayError = "";
      this.payHtml = "";
      this.useCoin = false;
      this.auto = false;
      this.showCoin = false;
      this.showCoupon = false;
      this.selectedCouponId = "";
      this.coin_coupon_ids = [];
      this.coin_coupons_count = 0;
      this.coin_amount = 0;
      this.voucher_amount = 0;
      this.getWayLoading = false;
      this.priceLoading = false;
      this.diaInitIng = true;
      this.isShowZf = true;
      this.orderData = {
        unpaid_timeout: 0,
        remain_pay_time: 0,
      };
    },
    async getCoinInfo() {
      await apiCoinClientCoupon().then((res) => {
        this.coin_name = res.data.data.name;
        this.coinClientInfo = res.data.data;
      });
    },
    // 启动倒计时
    startCountdown() {
      // 清除已有的倒计时
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
      }

      // 如果没有超时时间或剩余时间，不启动倒计时
      if (
        !this.orderData.unpaid_timeout ||
        this.orderData.remain_pay_time <= 0
      ) {
        return;
      }

      // 每秒递减
      this.countdownTimer = setInterval(() => {
        if (this.orderData.remain_pay_time > 0) {
          this.orderData.remain_pay_time--;
        } else {
          // 倒计时结束
          clearInterval(this.countdownTimer);
          this.$message.warning(lang.coin_text138);
          this.zfClose();
        }
      }, 1000);
    },
    handelSelect(item) {
      if(this.priceLoading || this.diaInitIng || this.doPayLoading)return;
      // 如果支付方式相同，则不进行任何操作
      if (this.zfData.gateway === item.name && !this.gatewayError) return;
      // 如果信用额不足，则提示
      if (
        item.name === "CreditLimit" &&
        this.zfData.amount * 1 > this.creditData.remaining_amount * 1
      ) {
        this.$message.error(lang.pay_text16);
        // 切换到不是余额和信用额的支付方式
        this.zfData.gateway = this.gatewayList.find(
          (item) => item.name !== "CreditLimit",
        )?.name;
        return;
      }
      // 如果当前是信用额支付 切换到别的支付方式 则勾选使用余额
      if (this.zfData.gateway === "CreditLimit" && this.balance * 1 > 0) {
        this.zfData.checked = true;
      }
      // 如果切换到余额支付，则取消勾选使用余额
      if (item.name === "CreditLimit") {
        this.zfData.checked = false;
      }
      this.zfData.gateway = item.name;
      this.zfSelectChange();
    },
    copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        // navigator clipboard 向剪贴板写文本
        this.$message.success(lang.pay_text17);
        return navigator.clipboard.writeText(text);
      } else {
        // 创建text area
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // 使text area不在viewport，同时设置不可见
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        this.$message.success(lang.pay_text17);
        return new Promise((res, rej) => {
          // 执行复制命令并移除文本框
          document.execCommand("copy") ? res() : rej();
          textArea.remove();
        });
      }
    },
    // 获取账户详情
    async getAccount() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      const res = await account();
        if(!cra1Current())return;
      if (res.data.status === 200) {
        this.balance = res.data.data.account.credit;
      }
    },
    // 支付关闭
    zfClose() {
      if (this.isTransfer) return;
      if(this.isPaySuccess)return;
      if (this._cra1Closing) return; this._cra1Closing = true;
      this.clearPolling(); this._cra1PayGeneration = (this._cra1PayGeneration || 0) + 1;
      if (!this.isPaySuccess && !this.isTransfer) {
        this.$emit("paycancel", this.zfData.orderId);
      }
      const wasRecharge=this.isCz;
      this.isShowZf = false;
      this.isCz = false;
      this.cantUseCredit = false;
      this.isShowPay = false;
      this.diaInitIng = false;
      clearInterval(this.timer);
      clearInterval(this.countdownTimer);
      this.time = 300000;
      if (this.zfData.checked && !this.isPaySuccess) {
        // 如果勾选了使用余额
        this.zfData.checked = false;
        // 取消使用余额
        const params = {
          id: this.zfData.orderId,
          use: 0,
        };
        if (!wasRecharge) {
          Promise.resolve(creditPay(params)).catch(()=>{});
        }
      }
    },
    //  授信详情
    async getCreditDetail() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        const res = await creditDetail();
        if(!cra1Current())return;
        if (res.data.status === 200) {
          this.creditData = res.data.data.credit_limit;
          if (
            this.creditData.status === "Active" &&
            !this.cantUseCredit &&
            this.creditData.remaining_amount * 1 > 0
          ) {
            this.gatewayList.unshift({
              id: "1411373683",
              name: "CreditLimit",
              title: lang.pay_text18,
              url: `${url}img/common/credit_log.svg`,
            });
          }
        }
      } catch (error) {
        if(!cra1Current())return;
      }
    },
    // 获取支付方式列表
    async getGateway() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        this.getWayLoading = true;
        const res = await gatewayList();
        if(!cra1Current())return;
        if (res.data.status === 200) {
          this.gatewayList = res.data.data.list;
          this.zfData.gateway = this.gatewayList[0]?.name;
          this.getWayLoading = false;
        } else throw new Error('支付方式暂时无法读取，请重试');
      } catch (error) {
        if(!cra1Current())return;
        this.gatewayList = [];
        this.getWayLoading = false;
        throw error;
      }
    },
    // 支付方式切换
    async zfSelectChange() {
      this.clearPolling();
      this.serverPayable=null;
      const generation=this._cra1SelectGeneration=(this._cra1SelectGeneration || 0)+1;
      const orderId=this.zfData.orderId, payGeneration=this._cra1PayGeneration;
      const current=()=>!this._cra1Destroyed && !this._cra1Closing && generation===this._cra1SelectGeneration && payGeneration===this._cra1PayGeneration && orderId===this.zfData.orderId;
      this.priceLoading=true; this.payLoading=true; this.gatewayError="";
      const previous=this._cra1PaymentWrite || Promise.resolve();
      let release;this._cra1PaymentWrite=new Promise(resolve=>{release=resolve});
      try {
        await previous.catch(()=>{});if(!current())return;
        if(!orderId || !this.zfData.gateway)throw new Error('暂无可用支付方式，请重试或联系客服');
        const balance=Number(this.balance), money=Number(this.zfData.amount), gateway=this.zfData.gateway;
        if(gateway==='CreditLimit')this.zfData.checked=false;
        if(gateway==='credit' && balance>0)this.zfData.checked=true;
        this.isShowPay=false;
        if(gateway==='credit'||gateway==='CreditLimit'||money===0||(this.zfData.checked&&balance>=money)){
          if(!this.isCz && this.order_customfields?.is_pre_invoice !== 1)await creditPay({id:orderId,use:Number(gateway!=='CreditLimit'&&this.zfData.checked&&balance>0)});
          if(current())await this.refreshOrderPrice();
          return;
        }
        if(!this.isCz && this.order_customfields?.is_pre_invoice !== 1)await creditPay({id:orderId,use:Number(this.zfData.checked&&balance>0)});
        if(!current())return;
        await this.refreshOrderPrice();if(!current())return;
        this.isShowPay=true; this.payHtml=''; this.isShowimg=true;
        const res=await pay({gateway,id:orderId});
        if(!current())return;
        if(res.data.status!==200)throw new Error(cra1CashierError({data:res.data}));
        if(res.data.code==='Paid'||res.data.data?.code==='Paid'){this.paid(orderId);return;}
        this.payHtml=res.data?.data?.html || '';
        if(!this.payHtml)throw new Error('支付信息暂未加载成功，请重试');
        this.$nextTick(()=>{if(current()&&this.$refs.payBox)$(this.$refs.payBox).html(this.payHtml)});
        this.time=300000;
        if(gateway!=='UserCustom')this.pollingStatus(orderId);
      } catch(error) {
        if(current()){this.isShowimg=false;this.isShowPay=true;this.gatewayError=cra1CashierError(error);this.$message.error(this.gatewayError);}
      } finally {
        release();
        if(current()){this.priceLoading=false;this.payLoading=false;this.diaInitIng=false;this.publishState();}
      }
    },
    async refreshOrderPrice() {
      const generation=this._cra1PayGeneration,selection=this._cra1SelectGeneration;
      const res=await orderDetails(this.zfData.orderId);
      if(this._cra1Destroyed||generation!==this._cra1PayGeneration||selection!==this._cra1SelectGeneration)return;
      const order=res.data?.data?.order;
      if(res.data?.status!==200 || !order?.id || order.amount_unpaid==null || !Number.isFinite(Number(order.amount_unpaid)))throw new Error('待付金额暂时无法核对，请重试');
      this.orderData=order;this.zfData.amount=order.amount;
      this.serverPayable=Number(order.amount_unpaid);this.publishState();
    },
    // 确认使用余额支付
    async handleOk() {
      if(this.doPayLoading || this.priceLoading || this.diaInitIng || !this.zfData.orderId || !this.zfData.gateway)return;
      const generation=this._cra1PayGeneration, orderId=this.zfData.orderId;
      this.doPayLoading = true;
      const params = {
        gateway:
          this.zfData.checked || this.zfData.amount == 0
            ? "credit"
            : "CreditLimit",
        id: this.zfData.orderId,
      };
      const subApi =
        this.zfData.gateway == "CreditLimit" ? payCreditLimit : pay;
      try {
        this.clearPolling();
        if(params.gateway==='credit' && !this.isCz && this.order_customfields?.is_pre_invoice !== 1)await creditPay({id:orderId,use:Number(Number(this.balance)>0)});
        if(this._cra1Destroyed || generation!==this._cra1PayGeneration)return;
        const res=await subApi(params);
        if(this._cra1Destroyed || generation!==this._cra1PayGeneration)return;
        if(res.data.status!==200)throw new Error(cra1CashierError({data:res.data}));
        // Credit-limit APIs may return success before settlement; verify the real order.
        const detail=await orderDetails(orderId);
        if(this._cra1Destroyed || generation!==this._cra1PayGeneration)return;
        if(detail.data?.data?.order?.status!=='Paid')throw new Error('订单尚未完成付款，请重新读取订单后再试');
        this.paid(orderId);
      } catch(error) {
        if(!this._cra1Destroyed && generation===this._cra1PayGeneration)this.$message.error(cra1CashierError(error));
      } finally {if(!this._cra1Destroyed && generation===this._cra1PayGeneration)this.doPayLoading=false;}
    },
    clearPolling(abort=true) {
      this._cra1PollGeneration = (this._cra1PollGeneration || 0) + 1;
      clearTimeout(this.timer); this.timer = null;
      if(abort){this._cra1StatusAbort?.abort();this._cra1StatusAbort=null;this._cra1StatusRequest=null;}
    },
    pollingStatus(id) {
      this.clearPolling();
      const generation = this._cra1PollGeneration;
      const current = () => !this._cra1Destroyed && generation === this._cra1PollGeneration && String(id) === String(this.zfData.orderId) && !this.isPaySuccess;
      const poll = async () => {
        if (!current()) return;
        if (!document.hidden) {
          try {
            const res = await this.readPaymentStatus(id);
            if (!current()) return;
            if (res.data.status===200 && (res.data.code === 'Paid' || res.data.data?.code === 'Paid')) {
              this.paid(id);return;
            }
            if([400,401].includes(Number(res.data.status))){this.clearPolling();this.gatewayError='当前支付已失效，请重新读取订单后再试';return;}
            this.time -= 2000;
            if (this.time <= 0) { this.clearPolling(); this.$message.error(lang.pay_text20); this.zfClose(); return; }
          } catch (error) {
            if (!current()) return;
            if ([400,401].includes(Number(error?.data?.status||error?.status||error?.response?.status))) { this.clearPolling();this.gatewayError='当前支付已失效，请重新读取订单后再试';return; }
          }
        }
        if(current()) this.timer = setTimeout(poll, 2000);
      };
      this.timer = setTimeout(poll,2000);
    },
    czPay(orderId) {
      this.isCz = true;
      this.cantUseCredit = true;
      this.showPayDialog(orderId);
    },

    formatLabel(item) {
      if (item.id === this.selectedCouponId && this.voucher_amount > 0) {
        const showAmount = Number(this.voucher_amount).toFixed(2);
        return `${item.code} (${lang.shoppingCar_tip_text16} ${this.commonData.currency_prefix}${showAmount})`;
      }
      return item.code;
    },

    handleVoucherChange(value) {
      if (value) {
        this.applyVoucher(value, 0);
      } else {
        this.applyVoucher("", 0);
      }
    },
    async applyVoucher(voucher_get_id = "", auto = 0, isInit = false) {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        this.priceLoading = true;
        const params = {
          order_id: this.zfData.orderId,
          use: voucher_get_id != "" || auto == 1 ? 1 : 0,
          auto,
          voucher_get_id,
        };
        const res = await apiApplyVoucher(params);
        if(!cra1Current())return;
        this.voucher_amount = Number(res.data.data.voucher_amount);
        if (res.data.data.voucher_get_id) {
          this.selectedCouponId = res.data.data.voucher_get_id;
        }
        const detailRes = await orderDetails(this.zfData.orderId);
        if(!cra1Current())return;
        const orderData = detailRes.data.data.order;
        this.zfData.amount = orderData.amount;
        this.priceLoading = false;
        if (isInit === false) {
          this.zfSelectChange();
        }
      } catch (error) {
        if(!cra1Current())return;
        this.priceLoading = false;
        this.voucher_amount = 0;
        this.$message.error(cra1CashierError(error));
        if (isInit === false) {
          this.zfSelectChange();
        }
      }
    },

    // 获取代金券列表
    async getVoucherList() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      try {
        this.couponListLoading = true;
        const res = await apiVoucherPayList({order_id: this.zfData.orderId});
        if(!cra1Current())return;
        if (res.data.status === 200) {
          this.couponList = res.data.data.list;
          const usedVoucher = this.couponList.find(
            (item) => item.is_applied === 1,
          );
          if (usedVoucher) {
            this.selectedCouponId = usedVoucher.id;
          }
        }
      } catch (error) {
        if(!cra1Current())return;
        this.couponList = [];
      } finally {
        this.couponListLoading = false;
      }
    },

    // 处理支付网关选择
    async handleGatewaySelection() {
      const cra1Generation=this._cra1PayGeneration, cra1Order=this.zfData.orderId;
      const cra1Current=()=>!this._cra1Destroyed && cra1Generation===this._cra1PayGeneration && cra1Order===this.zfData.orderId;

      // 获取支付方式列表
      // 处理余额支付逻辑
      if (!this.isCz) {
        // 获取账户余额
        const res = await account();
        if(!cra1Current())return;
        if (res.data.status === 200) {
          this.balance = res.data.data.account.credit;
          if (this.order_customfields?.is_pre_invoice !== 1) {
            this.addCreditGateway();
          }
        }
      }
      // 添加信用额支付方式
      if (this.isShowCredit && this.allowCredit && !this.isCz) {
        await this.getCreditDetail();
        if(!cra1Current())return;
      }
      this.zfData.gateway = this.gatewayList[0]?.name;

      // 如果当前是信用额支付 则判断是否超出信用额 超出则切换到别的支付方式
      if (this.zfData.gateway === "CreditLimit") {
        const isExceedLimit =
          this.zfData.amount * 1 > this.creditData.remaining_amount * 1;
        if (isExceedLimit) {
          this.zfData.gateway = this.gatewayList[1]?.name;
        }
      }
      // 如果余额大于0 且 可以使用余额 则勾选使用余额
      if (this.balance > 0 && this.order_customfields?.is_pre_invoice !== 1) {
        this.zfData.checked = true;
      }
    },

    // 添加余额支付方式
    addCreditGateway() {
      // 如果余额大于支付金额 则添加余额支付方式
      if ((this.zfData.amount * 1 === 0 || this.balance * 1 >= this.zfData.amount * 1 && this.balance * 1 > 0) && !this.gatewayList.some(item => item.name === "credit")) {
        this.gatewayList.unshift({
          id: 0,
          name: "credit",
          title: lang.order_text8,
          url: `${url}img/common/credit-icon.svg`,
        });
      }
    },

    async showPayDialog(orderId) {
      if (this.diaInitIng) return;
      this.diaInitIng = true;
      const generation=this._cra1PayGeneration=(this._cra1PayGeneration || 0)+1;
      const current=()=>!this._cra1Destroyed && generation===this._cra1PayGeneration;
      try {

        // 清除之前的倒计时定时器
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
        }

        this._cra1Closing = false;
        await this.initPay();
        if(!current())return;
        this.zfData.orderId = Number(orderId);
        // 获取订单详情
        const detailRes = await orderDetails(orderId);
        if (detailRes.data.status !== 200) {
          throw new Error("获取订单详情失败");
        }
        if(!current())return;
        const orderData = detailRes.data.data.order;
        if(!orderData?.id || orderData.amount==null || orderData.amount==='' || !Number.isFinite(Number(orderData.amount)))throw new Error('订单信息暂时无法读取，请从订单详情重新打开');
        this.orderData = orderData;
        this.order_customfields = detailRes.data.data.customfields;
        this.zfData.amount = orderData.amount;
        this.publishState();

        if (orderData.status === "Paid") {
          this.paid(this.zfData.orderId);
          return;
        }
        if(['Cancelled','Refunded','Failed'].includes(orderData.status)) {this.isShowZf=false;this.diaInitIng=false;return;}
        if(!['Unpaid','WaitUpload','WaitReview','ReviewFail'].includes(orderData.status))throw new Error('当前订单暂不支持付款，请在订单详情查看进度');
        this.isCz = orderData.type === "recharge";
        this.zfData.amount = orderData.amount;

        // 启动倒计时
        this.startCountdown();

        // 检查特殊订单状态
        const specialStatus = ["WaitUpload", "WaitReview", "ReviewFail"];
        if (specialStatus.includes(orderData.status)) {
          this.isTransfer = true;
          this.isShowZf = false;
          this.diaInitIng = false;
          return this.$refs.proof.getOrderDetails(this.zfData.orderId);
        }
        await this.getGateway();
        if(!current())return;
        // 处理支付方式选择
        await this.handleGatewaySelection();
        if(!current())return;
        const canUseCoinOrderType = [
          "renew",
          "upgrade",
          "new",
          "change_billing_cycle",
        ];

        if (
          havePlugin("IdcsmartVoucher") &&
          canUseCoinOrderType.includes(orderData.type)
        ) {
          await this.getVoucherList();
          if (this.couponList.length > 0) {
            await this.applyVoucher(this.selectedCouponId, 1, true);
            this.showCoupon = true;
          } else {
            this.showCoupon = false;
          }
        }
        const canUseCoin =
          havePlugin("Coin") && canUseCoinOrderType.includes(orderData.type);
        if (canUseCoin) {
          await this.getCoinInfo();
          // 优先判断订单是否用了平台币
          if (this.coinClientInfo?.use_coin === 1) {
            this.showCoin = true;
            this.auto = true;
            this.useCoin = true;
            await this.applyCoin(true);
            // 判断后台是否开启余额限制
          } else if (
            this.coinClientInfo?.credit_enough_no_use == 1 &&
            Number(this.balance) >= Number(orderData.amount)
          ) {
            this.showCoin = false;
          } else if (this.coinClientInfo?.available_coin) {
            this.showCoin = true;
            this.auto = true;
            this.useCoin = true;
            await this.applyCoin(true);
          }
        }
        // 切换支付方式
        if(!current())return;
        if(this.initialGateway && this.gatewayList.some(item=>item.name===this.initialGateway))this.zfData.gateway=this.initialGateway;
        await this.zfSelectChange();
      } catch (error) {
        if(!current())return;
        this.getWayLoading = false;
        this.diaInitIng = false;
        // 订单详情未取到时，不能留着 0 元占位的弹窗让用户确认支付：关闭弹窗并提示真实错误
        if (!this.orderData || !this.orderData.id) {
          if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
          }
          this.isShowZf = false;
          this.$message.error(cra1CashierError(error));
        }
        throw new Error(cra1CashierError(error));
      }
    },
  },
};
