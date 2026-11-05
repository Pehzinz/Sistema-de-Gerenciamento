package com.nexo.sistema_gestao;

import com.nexo.sistema_gestao.security.RateLimitFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class RateLimitFilterTests {
    @Test void excessiveLoginRequestsAreRejectedWithoutBlockingOtherIps() throws Exception {
        var filter = new RateLimitFilter();
        for (int i = 1; i <= 31; i++) {
            var request = new MockHttpServletRequest("POST", "/api/login");
            request.setServletPath("/api/login"); request.setRemoteAddr("192.0.2.1");
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (req, res) -> {});
            assertEquals(i <= 30 ? 200 : 429, response.getStatus());
            if (i == 31) assertEquals("60", response.getHeader("Retry-After"));
        }
        var another = new MockHttpServletRequest("POST", "/api/login");
        another.setServletPath("/api/login"); another.setRemoteAddr("192.0.2.2");
        var response = new MockHttpServletResponse();
        filter.doFilter(another, response, (req, res) -> {});
        assertEquals(200, response.getStatus());
    }
}
