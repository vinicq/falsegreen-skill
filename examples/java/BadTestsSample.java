package examples;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Examples of false-positive test patterns in Java/JUnit 5.
 * Each test passes green but does not verify correct behavior.
 * See reference.md for the case number and judgment.
 */
@ExtendWith(MockitoExtension.class)
class BadTestsSample {

    // ─── Case 10: Mocks the unit under test ──────────────────────────────

    @Mock
    Calculator calculator;   // BAD: calculator IS the SUT

    @Test
    void case10_mocksTheSut() {
        when(calculator.add(2, 3)).thenReturn(5);
        assertEquals(5, calculator.add(2, 3)); // C10: tests the mock
    }

    // ─── Case 10 clean: mocks a dependency, not the SUT ──────────────────

    @Mock
    UserRepository repo;

    @InjectMocks
    UserService sut;         // CLEAN: sut is the real production class

    @Test
    void case10_clean() {
        when(repo.findById(1L)).thenReturn(java.util.Optional.of(new User(1L, "Alice")));
        User result = sut.getUser(1L);
        assertEquals("Alice", result.getName()); // tests real UserService logic
    }

    // ─── Case 11: Asserts the value fed to the mock ───────────────────────

    @Mock
    PriceRepository priceRepo;

    @InjectMocks
    PriceService priceService;

    @Test
    void case11_assertsTheFedValue() {
        when(priceRepo.getBasePrice("SKU-1")).thenReturn(100.0);
        double result = priceService.getPrice("SKU-1");
        assertEquals(100.0, result); // C11 if getPrice() just returns priceRepo.getBasePrice()
    }

    // ─── Case 12: Re-implements the production formula ────────────────────

    @Test
    void case12_reimplementsFormula() {
        double price = 200.0, rate = 0.15;
        double expected = price - (price * rate); // re-implements applyDiscount
        // If applyDiscount does price - (price * rate), this never catches a bug
        // assertEquals(expected, sut.applyDiscount(price, rate)); // C12
    }

    // ─── Case: JUnit 4-style expected that is too broad ──────────────────

    @Test
    void case9_toobroadException() {
        // C9: catches Exception instead of the specific type
        assertThrows(Exception.class, () -> {
            sut.processOrder(null); // any exception passes this, even NPE
        });
    }

    // Placeholder types for compilation
    static class Calculator { int add(int a, int b) { return a + b; } }
    static class User { User(long id, String name) {} String getName() { return ""; } }
    static class UserRepository { java.util.Optional<User> findById(long id) { return java.util.Optional.empty(); } }
    static class UserService {
        private UserRepository repo;
        User getUser(long id) { return repo.findById(id).orElseThrow(); }
    }
    static class PriceRepository { double getBasePrice(String sku) { return 0; } }
    static class PriceService {
        private PriceRepository repo;
        double getPrice(String sku) { return repo.getBasePrice(sku); }
        double applyDiscount(double price, double rate) { return price - price * rate; }
        void processOrder(Object o) { if (o == null) throw new IllegalArgumentException(); }
    }
}
