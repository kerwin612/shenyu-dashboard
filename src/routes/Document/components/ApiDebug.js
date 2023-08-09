/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Button, Col, Empty, Form, Icon, Input, message, Row, Select, Tabs, Typography} from "antd";
import React, {createRef, forwardRef, useContext, useEffect, useImperativeHandle, useState} from "react";
import ReactJson from "react-json-view";
import fetch from "dva/fetch";
import {
  createOrUpdateMockRequest,
  deleteMockRequest,
  getApiMockRequest,
  sandboxProxyGateway
} from "../../../services/api";
import ApiContext from "./ApiContext";
import HeadersEditor from "./HeadersEditor";
import {getIntlContent} from "../../../utils/IntlUtils";
import AuthButton from "../../../utils/AuthButton";
import {Method} from "./globalData";

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const FormItem = Form.Item;
const InputGroup = Input.Group

const FCForm = forwardRef(({ form, onSubmit }, ref) => {
  useImperativeHandle(ref, () => ({
    form
  }));

  const {
    apiDetail,
    apiMock,
    apiData: {envProps = []}
  } = useContext(ApiContext);
  const [questJson, setRequestJson] = useState(JSON.parse(apiMock.body || '{}'));
  const [initialValue, setInitialValue] = useState({
    id: apiMock.id,
    apiId: apiDetail.id,
    host: apiMock.host,
    port: apiMock.port,
    url: apiMock.url,
    pathVariable: apiMock.pathVariable,
    query: apiMock.query,
    header: apiMock.header,
    body: apiMock.body
  });
  const [activeKey, setActiveKey] = useState("1");

  const getDefaultHeaderByKey = (key) => {
    return {"Content-type": key === '1' ? "application/json" : "application/x-www-form-urlencoded"}
  }

  useEffect(
    () => {
      setInitialValue({
        id: apiMock.id,
        apiId: apiDetail.id,
        host: apiMock.host,
        port: apiMock.port,
        url: apiMock.url,
        pathVariable: apiMock.pathVariable,
        query: apiMock.query,
        header: apiMock.header,
        body: apiMock.body
      });
      form.resetFields("requestUrl");
      setRequestJson(JSON.parse(apiMock.body || '{}'));
    },
    [apiMock.id]
  );

  useEffect(
    () => {
      form.setFieldsValue({httpMethod: Method?.[apiDetail.httpMethod]})
    },
    [apiDetail.httpMethod]
  );

  useEffect(
    () => {
      setInitialValue({url:apiDetail.apiPath})
    },
    [apiDetail.apiPath]
  )

  useEffect(
    () => {
      form.setFieldsValue({headers: initialValue.header || JSON.stringify(getDefaultHeaderByKey(activeKey))})
    },
    [initialValue.header]
  );

  useEffect(
    () => {
      form.setFieldsValue({querys: initialValue.query || "{}"})
    },
    [initialValue.query]
  );

  const handleSubmit = e => {
    e.preventDefault();
    ref.current.form.validateFieldsAndScroll((errors, values) => {
      if (!errors) {
        onSubmit({
          ...values,
          bizParam: questJson
        });
      }
    });
  }

  const updateJson = obj => {
    setRequestJson(obj.updated_src);
  };

  const handlerSaveOrUpdate  = async () => {
    ref.current.form.validateFieldsAndScroll( async (errors) => {
      if (!errors) {
        const fields = form.getFieldsValue();
        let requestUrl = fields.requestUrl;
        const url = new URL(requestUrl);
        const params = {
          ...initialValue,
          apiId: apiDetail.id,
          host: url.hostname,
          port: url.port,
          url: requestUrl,
          header: fields.headers,
          query: fields.querys,
          body: JSON.stringify(questJson),
          pathVariable: url.search || ''
        }
        let rs = await createOrUpdateMockRequest(params);
        if (rs.code !== 200) {
          message.error(rs.msg);
        } else {
          const { code, message: msg, data } = await getApiMockRequest(apiDetail.id);
          if (code !== 200) {
            message.error(msg);
            return;
          }
          message.success(rs.message);
          setInitialValue({...initialValue, id: data.id});
        }
      }
    });
  };

  const handlerDelete = async () => {
    if (initialValue.id) {
      let rs = await deleteMockRequest(initialValue.id);
      if (rs.code !== 200) {
        message.error(rs.msg);
      } else {
        message.success(rs.message);
      }
    }
    resetContext()
  };

  const resetContext = () => {
    setInitialValue({
      id: null,
      apiId: apiDetail.id,
      host: undefined,
      port: null,
      url: null,
      pathVariable: null,
      query: null,
      header: null,
      body: null
    });
    setRequestJson({});
    form.resetFields("requestUrl");
  }

  const changeParamTab = (key) => {
    setActiveKey(key);
    let header = form.getFieldsValue().headers;
    let headerJson = {...JSON.parse(header), ...getDefaultHeaderByKey(key)};
    setInitialValue({...initialValue, header: JSON.stringify(headerJson)});
  }

  return (
    <Form onSubmit={handleSubmit}>
      <Title level={4}>
        {getIntlContent("SHENYU.DOCUMENT.APIDOC.INFO.REQUEST.INFORMATION")}
      </Title>
      <FormItem label={getIntlContent("SHENYU.DOCUMENT.APIDOC.INFO.ADDRESS")}>
        {form.getFieldDecorator("requestUrl", {
          initialValue: initialValue.url || '',
          rules: [
            {
              type: "string",
              required: true,
              pattern: /^https?:\/\/([^:]+):(\d+)(\/.+)$/
            }
          ]
        })(
          <InputGroup compact>
            <Select
              style={{width: '40%'}}
              onChange={host => {
                const url = new URL(host);
                host = `${url.protocol}//${url.hostname}:${url.port || '80'}`;
                setInitialValue({...initialValue, host})
                const requestUrl = `${host}${initialValue.url ?? ""}`
                form.setFieldsValue({requestUrl})
              }}
              value={initialValue.host}
            >
              {Object.values(envProps).map((e, i) => {
                return (
                  <Select.Option key={`${e.addressUrl} ${i}`} value={e.addressUrl}>
                    {`${e.envLabel}  ${e.addressUrl}`}
                  </Select.Option>
                );
              })}
            </Select>
            <Input
              style={{width: '60%'}}
              value={initialValue.url}
              onChange={e => {
                setInitialValue({...initialValue, url: e.target.value})
                const requestUrl = `${initialValue.host ?? ""}${e.target.value}`
                form.setFieldsValue({requestUrl})
              }}
            />
          </InputGroup>
        )}
      </FormItem>

      <FormItem label="Headers">
        {form.getFieldDecorator("headers", {
          initialValue: initialValue.header,
          rules: []
        })(<HeadersEditor buttonText={getIntlContent("SHENYU.DOCUMENT.APIDOC.DEBUG.MOCK.ADD.HEADER")} mockId={apiMock.id} />)}
      </FormItem>

      <FormItem label={getIntlContent("SHENYU.COMMON.HTTP.METHOD")}>
        {form.getFieldDecorator("httpMethod", {
          initialValue: Method?.[apiDetail.httpMethod],
          rules: [{ type: "string", required: true }]
        })
        (
          <Input
            allowClear
            readOnly={true}
          />
        )}
      </FormItem>
      <FormItem
        label={getIntlContent("SHENYU.DOCUMENT.APIDOC.INFO.REQUEST.PARAMETERS")}
        required
      />

      <Tabs
        activeKey={activeKey}
        onChange={key => changeParamTab(key)}
      >
        <Tabs.TabPane
          tab={
            <>
              <Icon type="file-text" />
              BODY
            </>
          }
          key="1"
        >
          <Row gutter={16}>
            <Col span={14}>
              <ReactJson
                src={questJson}
                theme="monokai"
                displayDataTypes={false}
                name={false}
                onAdd={updateJson}
                onEdit={updateJson}
                onDelete={updateJson}
                style={{ borderRadius: 4, padding: 16 }}
              />
            </Col>
          </Row>
        </Tabs.TabPane>

        <Tabs.TabPane
          tab={
            <>
              <Icon type="file-text" />
              QUERY
            </>
          }
          key="2"
        >

          <FormItem>
            {form.getFieldDecorator("querys", {
              initialValue: initialValue.query || "{}",
              rules: []
            })(<HeadersEditor buttonText={getIntlContent("SHENYU.DOCUMENT.APIDOC.DEBUG.MOCK.ADD.QUERY")} mockId={apiMock.id} />)}
          </FormItem>
        </Tabs.TabPane>
      </Tabs>


      <AuthButton perms="document:apirun:send">
        <FormItem label=" " colon={false}>
          <Button htmlType="submit" type="primary">
            {getIntlContent("SHENYU.DOCUMENT.APIDOC.INFO.SEND.REQUEST")}
          </Button>

          <Button onClick={handlerSaveOrUpdate}>
            {getIntlContent("SHENYU.DOCUMENT.APIDOC.DEBUG.MOCK.SAVE")}
          </Button>

          <Button onClick={handlerDelete}>
            {getIntlContent("SHENYU.DOCUMENT.APIDOC.DEBUG.MOCK.RESET")}
          </Button>
        </FormItem>
      </AuthButton>
    </Form>
  );
});

const EnhancedFCForm = Form.create()(FCForm);

function ApiDebug() {
  const {
    apiDetail: { id }
  } = useContext(ApiContext);
  const [responseInfo, setResponseInfo] = useState({});
  const [activeKey, setActiveKey] = useState("2");
  const formRef = createRef();

  const handleSubmit = async values => {
    const { headers, requestUrl, ...params } = values;
    params.headers = JSON.parse(headers);
    params.requestUrl = requestUrl;
    fetch(sandboxProxyGateway(), {
      method: "POST",
      headers: {
        "X-Access-Token": sessionStorage.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    }).then(async response => {
      const data = await response.json();
      setResponseInfo({
        "sandbox-params": response.headers.get("sandbox-params"),
        "sandbox-beforesign": response.headers.get("sandbox-beforesign"),
        "sandbox-sign": response.headers.get("sandbox-sign"),
        body: data
      });
    });
  };

  useEffect(
    () => {
      setResponseInfo({});
      setActiveKey("2");
    },
    [id]
  );


  return (
    <>
      <EnhancedFCForm wrappedComponentRef={formRef} onSubmit={handleSubmit} />
      <Tabs
        type="card"
        activeKey={activeKey}
        onChange={key => setActiveKey(key)}
      >
        <TabPane
          tab={getIntlContent(
            "SHENYU.DOCUMENT.APIDOC.INFO.REQUEST.INFORMATION"
          )}
          key="1"
        >
          {Object.keys(responseInfo).length ? (
            <>
              <Paragraph>
                <Text strong>
                  {getIntlContent(
                    "SHENYU.DOCUMENT.APIDOC.CONTENTS.TO.BE.SIGNED"
                  )}
                </Text>
                <br />
                <Text code>
                  {responseInfo["sandbox-beforesign"] || "undefined"}
                </Text>
              </Paragraph>
              <Paragraph>
                <Text strong>
                  {getIntlContent("SHENYU.DOCUMENT.APIDOC.SIGNATURE")}
                </Text>
                <br />
                <Text code>{responseInfo["sandbox-sign"] || "undefined"}</Text>
              </Paragraph>
            </>
          ) : (
            <Empty description={false} />
          )}
        </TabPane>
        <TabPane
          tab={getIntlContent("SHENYU.DOCUMENT.APIDOC.INFO.REQUEST.RESULTS")}
          key="2"
        >
          {Object.keys(responseInfo).length ? (
            <ReactJson src={responseInfo.body} name={false} />
          ) : (
            <Empty description={false} />
          )}
        </TabPane>
      </Tabs>
    </>
  );
}

export default ApiDebug;
